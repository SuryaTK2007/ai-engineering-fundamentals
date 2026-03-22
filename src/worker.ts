export default {
  fetch(_request: Request, _env: Env) {
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

interface Env {}
