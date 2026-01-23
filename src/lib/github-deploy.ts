const GITHUB_API_BASE = 'https://api.github.com';

function getGithubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function getOwner(): string {
  const owner = process.env.GITHUB_DEPLOY_OWNER;
  if (!owner) {
    throw new Error('GITHUB_DEPLOY_OWNER is not set');
  }
  return owner;
}

interface FileContent {
  path: string;
  content: string;
}

function generateServerJs(): string {
  return `const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`;
}

function generatePackageJson(name: string): string {
  return JSON.stringify({
    name,
    version: '1.0.0',
    scripts: {
      start: 'node server.js',
    },
    dependencies: {
      express: '^4.18.2',
    },
  }, null, 2);
}

export interface CreateDeployRepoResult {
  repoUrl: string;
  htmlUrl: string;
}

export async function createDeployRepo(
  repoName: string,
  htmlContent: string
): Promise<CreateDeployRepoResult> {
  const owner = getOwner();
  const headers = getGithubHeaders();

  // 1. Create repository
  const createRepoResponse = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: 'Auto-deployed from LP Builder',
      private: false,
      auto_init: true,
    }),
  });

  if (!createRepoResponse.ok) {
    const error = await createRepoResponse.text();
    throw new Error(`Failed to create repo: ${createRepoResponse.status} - ${error}`);
  }

  const repo = await createRepoResponse.json();

  // Wait for repo initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Get default branch SHA
  const refResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/ref/heads/main`,
    { headers }
  );

  if (!refResponse.ok) {
    throw new Error('Failed to get repo ref');
  }

  const refData = await refResponse.json();
  const latestCommitSha = refData.object.sha;

  // 3. Get the tree of the latest commit
  const commitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/commits/${latestCommitSha}`,
    { headers }
  );
  const commitData = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;

  // 4. Create blobs for each file
  const files: FileContent[] = [
    { path: 'public/index.html', content: htmlContent },
    { path: 'server.js', content: generateServerJs() },
    { path: 'package.json', content: generatePackageJson(repoName) },
  ];

  const treeItems = [];
  for (const file of files) {
    const blobResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/blobs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
        }),
      }
    );

    if (!blobResponse.ok) {
      throw new Error(`Failed to create blob for ${file.path}`);
    }

    const blobData = await blobResponse.json();
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // 5. Create tree
  const treeResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/trees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems,
      }),
    }
  );

  if (!treeResponse.ok) {
    throw new Error('Failed to create tree');
  }

  const treeData = await treeResponse.json();

  // 6. Create commit
  const newCommitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'Initial deployment from LP Builder',
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    }
  );

  if (!newCommitResponse.ok) {
    throw new Error('Failed to create commit');
  }

  const newCommitData = await newCommitResponse.json();

  // 7. Update ref
  const updateRefResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/git/refs/heads/main`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    }
  );

  if (!updateRefResponse.ok) {
    throw new Error('Failed to update ref');
  }

  return {
    repoUrl: repo.clone_url,
    htmlUrl: repo.html_url,
  };
}

export async function updateRepoContent(
  repoName: string,
  htmlContent: string
): Promise<void> {
  const owner = getOwner();
  const headers = getGithubHeaders();

  // Get current file SHA
  const fileResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/contents/public/index.html`,
    { headers }
  );

  if (!fileResponse.ok) {
    throw new Error('Failed to get current file');
  }

  const fileData = await fileResponse.json();

  // Update file
  const updateResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repoName}/contents/public/index.html`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'Update from LP Builder',
        content: Buffer.from(htmlContent).toString('base64'),
        sha: fileData.sha,
      }),
    }
  );

  if (!updateResponse.ok) {
    throw new Error('Failed to update file');
  }
}
