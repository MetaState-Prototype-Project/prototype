// Import reflect-metadata for TypeORM decorators
import "reflect-metadata";

// Configure testcontainers to use Docker socket directly
process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE || "/var/run/docker.sock";
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED || "false";

