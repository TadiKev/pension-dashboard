from django.http import HttpResponse

class OptionsPassthroughMiddleware:
    """
    Return 200 for OPTIONS preflight on /api/* and add permissive CORS headers on API responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Preflight short-circuit for API paths
        if request.method == "OPTIONS" and request.path.startswith("/api/"):
            origin = request.headers.get("Origin", "*")
            request_headers = request.headers.get("Access-Control-Request-Headers", "Authorization,Content-Type")
            request_method = request.headers.get("Access-Control-Request-Method", "POST, GET, OPTIONS, PUT, DELETE, PATCH")

            response = HttpResponse()
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Methods"] = request_method
            response["Access-Control-Allow-Headers"] = request_headers
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Max-Age"] = "86400"
            response.status_code = 200
            return response

        # Normal request -> let view handle it
        response = self.get_response(request)

        # If this is an API path, ensure CORS headers are present on the response too
        if request.path.startswith("/api/"):
            origin = request.headers.get("Origin")
            if origin:
                response["Access-Control-Allow-Origin"] = origin
            else:
                response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Credentials"] = "true"
            # reflect requested headers/methods optionally:
            response.setdefault("Vary", "Origin")

        return response
