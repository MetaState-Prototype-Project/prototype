import axios from "axios";

const CONSUL_HOST = process.env.CONSUL_HOST || "localhost";
const CONSUL_PORT = process.env.CONSUL_PORT || "8500";

export async function resolveService(w3id: string) {
  try {
    const response = await axios.get(
      `http://${CONSUL_HOST}:${CONSUL_PORT}/v1/catalog/service/evault`,
      {
        params: {
          filter: `ServiceMeta.whois=="${w3id}"`,
        },
      }
    );

    const services = response.data;
    if (services && services.length > 0) {
      const address = `http://${services[0].ServiceAddress}:${services[0].ServicePort}`;
      return {
        graphql: `${address}/graphql`,
        whois: `${address}/whois`,
        requestWatcherSignature: `${address}/watchers/request`,
        wathcerSignEndpoint: `${address}/watchers/request`,
      };
    }
    return null;
  } catch (error) {
    console.error("Error resolving service:", error);
    throw error;
  }
}
