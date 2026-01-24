const RENDER_API_BASE = 'https://api.render.com/v1';

function getRenderHeaders(apiKey: string): HeadersInit {
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export interface CreateStaticSiteParams {
  name: string;
  repoUrl: string;
  branch?: string;
  apiKey: string;
}

export interface RenderService {
  id: string;
  name: string;
  status: string;
  serviceDetails?: {
    url?: string;
  };
}

// Fetch the Render account owner ID (required for service creation)
async function getOwnerId(apiKey: string): Promise<string> {
  const response = await fetch(`${RENDER_API_BASE}/owners?limit=1`, {
    method: 'GET',
    headers: getRenderHeaders(apiKey),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Render認証エラー: APIキーを確認してください (${response.status})`);
  }

  const owners = await response.json();
  if (!owners || owners.length === 0) {
    throw new Error('Renderアカウントのオーナーが見つかりません');
  }

  return owners[0].owner.id;
}

// Create a Static Site on Render (free tier)
export async function createStaticSite(params: CreateStaticSiteParams): Promise<RenderService> {
  const { name, repoUrl, branch = 'main', apiKey } = params;

  const ownerId = await getOwnerId(apiKey);

  const response = await fetch(`${RENDER_API_BASE}/services`, {
    method: 'POST',
    headers: getRenderHeaders(apiKey),
    body: JSON.stringify({
      type: 'static_site',
      name,
      ownerId,
      repo: repoUrl,
      autoDeploy: 'yes',
      branch,
      serviceDetails: {
        publishPath: './public',
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Renderサービス作成エラー: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.service.id,
    name: data.service.name,
    status: 'building',
    serviceDetails: data.service.serviceDetails,
  };
}

export async function getServiceStatus(serviceId: string, apiKey: string): Promise<{ status: string; url?: string }> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    method: 'GET',
    headers: getRenderHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Render API error: ${response.status}`);
  }

  const data = await response.json();

  // Check latest deploy status
  const deploysResponse = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys?limit=1`, {
    method: 'GET',
    headers: getRenderHeaders(apiKey),
  });

  let deployStatus = 'unknown';
  if (deploysResponse.ok) {
    const deploys = await deploysResponse.json();
    if (deploys.length > 0) {
      const latestDeploy = deploys[0].deploy;
      deployStatus = latestDeploy.status;
    }
  }

  // Static sites use serviceDetails.url for the URL
  const url = data.serviceDetails?.url
    ? (data.serviceDetails.url.startsWith('http') ? data.serviceDetails.url : `https://${data.serviceDetails.url}`)
    : undefined;

  let status: string;
  if (deployStatus === 'live') {
    status = 'live';
  } else if (deployStatus === 'build_failed' || deployStatus === 'update_failed' || deployStatus === 'pre_deploy_failed') {
    status = 'failed';
  } else if (deployStatus === 'build_in_progress' || deployStatus === 'update_in_progress' || deployStatus === 'pre_deploy_in_progress') {
    status = 'building';
  } else {
    status = 'pending';
  }

  return { status, url };
}

export async function triggerDeploy(serviceId: string, apiKey: string): Promise<void> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: getRenderHeaders(apiKey),
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Render API error: ${response.status}`);
  }
}

export async function deleteService(serviceId: string, apiKey: string): Promise<void> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    method: 'DELETE',
    headers: getRenderHeaders(apiKey),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Render API error: ${response.status}`);
  }
}
