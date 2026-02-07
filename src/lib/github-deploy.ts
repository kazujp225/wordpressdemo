const GITHUB_API_BASE = 'https://api.github.com';

function getGithubHeaders(token: string): HeadersInit {
  return {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

export interface CreateDeployRepoResult {
  repoUrl: string;
  htmlUrl: string;
}

export interface DeployCredentials {
  githubToken: string;
  githubOwner: string;
}

export async function createDeployRepo(
  repoName: string,
  htmlContent: string,
  credentials: DeployCredentials
): Promise<CreateDeployRepoResult> {
  const { githubToken, githubOwner } = credentials;
  const headers = getGithubHeaders(githubToken);

  // 1. Create repository
  const createRepoResponse = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: 'Static site deployed from OTASUKE LP',
      private: false,
      auto_init: true,
    }),
  });

  if (!createRepoResponse.ok) {
    const error = await createRepoResponse.text();
    if (createRepoResponse.status === 401) {
      throw new Error('GitHub認証エラー: トークンを確認してください');
    }
    throw new Error(`GitHubリポジトリ作成エラー: ${createRepoResponse.status} - ${error}`);
  }

  const repo = await createRepoResponse.json();

  // Wait for repo initialization
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 2. Get default branch SHA
  const refResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/ref/heads/main`,
    { headers }
  );

  if (!refResponse.ok) {
    throw new Error('リポジトリの初期化待機中にエラーが発生しました');
  }

  const refData = await refResponse.json();
  const latestCommitSha = refData.object.sha;

  // 3. Get the tree of the latest commit
  const commitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/commits/${latestCommitSha}`,
    { headers }
  );
  const commitData = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;

  // 4. Create blob for index.html in public/ directory
  const blobResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/blobs`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: htmlContent,
        encoding: 'utf-8',
      }),
    }
  );

  if (!blobResponse.ok) {
    throw new Error('HTMLファイルのアップロードに失敗しました');
  }

  const blobData = await blobResponse.json();

  // 5. Create tree with public/index.html
  const treeResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/trees`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: [
          {
            path: 'public/index.html',
            mode: '100644',
            type: 'blob',
            sha: blobData.sha,
          },
        ],
      }),
    }
  );

  if (!treeResponse.ok) {
    throw new Error('Gitツリーの作成に失敗しました');
  }

  const treeData = await treeResponse.json();

  // 6. Create commit
  const newCommitResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/commits`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: 'Deploy static site from OTASUKE LP',
        tree: treeData.sha,
        parents: [latestCommitSha],
      }),
    }
  );

  if (!newCommitResponse.ok) {
    throw new Error('コミットの作成に失敗しました');
  }

  const newCommitData = await newCommitResponse.json();

  // 7. Update ref
  const updateRefResponse = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}/git/refs/heads/main`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: newCommitData.sha,
      }),
    }
  );

  if (!updateRefResponse.ok) {
    throw new Error('ブランチの更新に失敗しました');
  }

  return {
    repoUrl: repo.clone_url,
    htmlUrl: repo.html_url,
  };
}

// Delete a GitHub repository (used for cleanup on deploy failure)
export async function deleteGithubRepo(
  repoName: string,
  credentials: DeployCredentials
): Promise<void> {
  const { githubToken, githubOwner } = credentials;
  const headers = getGithubHeaders(githubToken);

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${githubOwner}/${repoName}`,
    { method: 'DELETE', headers }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`GitHub repo deletion failed: ${response.status}`);
  }
}
