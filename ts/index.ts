import dotenv from "dotenv";
import express from "express";
import { App } from "octokit";

dotenv.config({ path: ".env" });

const app = express();
const port = 8000;

// const CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID as string;
// const CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET as string;
// const REDIRECT_URI = `http://localhost:${port}/callback`;
const APP_ID = process.env.GITHUB_APP_ID as string;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY as string;

// Github App instance
const githubApp = new App({
  appId: APP_ID,
  privateKey: PRIVATE_KEY,
});

app.get("/install", (_, res) => {
  const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new`;
  res.redirect(installUrl);
});

app.get("/callback", async (req, res) => {
  const installationId = req.query.installation_id;
  if (!installationId) {
    return res.status(400).send("Installation ID is missing");
  }

  try {
    const octokit = await githubApp.getInstallationOctokit(
      Number(installationId)
    );

    // Fetch the installation details
    const { data: installationData } = await octokit.request(
      "GET /app/installations/{installation_id}",
      {
        installation_id: Number(installationId),
      }
    );

    // // Extract the access_tokens_url from installationData
    // const accessTokensUrl = installationData.access_tokens_url;

    // // Use the access_tokens_url to get the access token
    // const { data: tokenData } = await octokit.request(
    //   "POST " + accessTokensUrl
    // );

    // // The access token is now available in tokenData.token
    // const accessToken = tokenData.token;

    // Check if the installation is for an organization
    if (
      installationData.account &&
      (installationData.account as any).type === "Organization"
    ) {
      const { data: orgData } = await octokit.request("GET /orgs/{org}", {
        org: (installationData.account as { login: string }).login,
      });

      res.json({
        message: "App installed successfully in the organization",
        organization: {
          name: orgData.name,
          login: orgData.login,
          description: orgData.description,
          url: orgData.html_url,
          repos: orgData.public_repos,
          members: orgData.public_members_url,
        },
      });
    } else {
      res.json({
        message: "App installed successfully, but not in an organization",
        account: installationData.account,
      });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("An error occurred");
  }
});

app.get("/org-repos/:org", async (req, res) => {
  const org = req.params.org;
  if (!org) {
    return res.status(400).send("Organization name is required");
  }

  try {
    const installations = await githubApp.octokit.request(
      "GET /app/installations"
    );
    const installation = installations.data.find(
      (inst) =>
        inst.account && inst.account.login.toLowerCase() === org.toLowerCase()
    );

    if (!installation) {
      return res.status(404).send("App is not installed in this organization");
    }

    const octokit = await githubApp.getInstallationOctokit(installation.id);

    const { data: repos } = await octokit.request("GET /orgs/{org}/repos", {
      org: org,
      type: "all",
      sort: "updated",
      direction: "desc",
      per_page: 10,
    });

    res.json({
      organization: org,
      repositories: repos.map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        url: repo.html_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        updated_at: repo.updated_at,
      })),
    });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    res.status(500).send("An error occurred while fetching repositories");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(
    `Visit http://localhost:${port}/install to start the installation process`
  );
});
