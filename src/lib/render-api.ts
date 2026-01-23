const RENDER_API_BASE = 'https://api.render.com/v1';

function getRenderHeaders(): HeadersInit {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    throw new Error('RENDER_API_KEY is not set');
  }
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export interface CreateWebServiceParams {
  name: string;
  repoUrl: string;
  branch?: string;
}

export interface RenderService {
  id: string;
  name: string;
  status: string;
  serviceDetails?: {
    url?: string;
  };
}

export async function createWebService(params: CreateWebServiceParams): Promise<RenderService> {
  const { name, repoUrl, branch = 'main' } = params;

  const response = await fetch(`${RENDER_API_BASE}/services`, {
    method: 'POST',
    headers: getRenderHeaders(),
    body: JSON.stringify({
      type: 'web_service',
      name,
      repo: repoUrl,
      autoDeploy: 'yes',
      branch,
      serviceDetails: {
        runtime: 'node',
        buildCommand: 'npm install',
        startCommand: 'node server.js',
        plan: 'free',
        envSpecificDetails: {
          buildCommand: 'npm install',
          startCommand: 'node server.js',
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Render API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    id: data.service.id,
    name: data.service.name,
    status: data.service.suspended === 'suspended' ? 'suspended' : 'deploying',
    serviceDetails: data.service.serviceDetails,
  };
}

export async function getServiceStatus(serviceId: string): Promise<{ status: string; url?: string }> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    method: 'GET',
    headers: getRenderHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Render API error: ${response.status}`);
  }

  const data = await response.json();

  // Check latest deploy status
  const deploysResponse = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys?limit=1`, {
    method: 'GET',
    headers: getRenderHeaders(),
  });

  let deployStatus = 'unknown';
  if (deploysResponse.ok) {
    const deploys = await deploysResponse.json();
    if (deploys.length > 0) {
      const latestDeploy = deploys[0].deploy;
      deployStatus = latestDeploy.status; // build_in_progress | update_in_progress | live | deactivated | build_failed | update_failed | canceled | pre_deploy_in_progress | pre_deploy_failed
    }
  }

  const url = data.serviceDetails?.url
    ? `https://${data.serviceDetails.url}`
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

export async function triggerDeploy(serviceId: string): Promise<void> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: getRenderHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Render API error: ${response.status}`);
  }
}

export async function deleteService(serviceId: string): Promise<void> {
  const response = await fetch(`${RENDER_API_BASE}/services/${serviceId}`, {
    method: 'DELETE',
    headers: getRenderHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Render API error: ${response.status}`);
  }
}
