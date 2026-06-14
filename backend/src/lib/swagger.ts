export const swaggerSpec = {
  "openapi": "3.0.0",
  "info": {
    "title": "Obscura Agent Order API",
    "description": "Programmatic interface for AI agents to query active hardware metrics, commit cryptographically private orders, reveal parameters, lease compute capacity via escrow contracts, and retrieve connection details.\n\n### HTTP 402 Payment Required (X402 Gate)\nWhen querying connection details for a matched order, if the lease has not been settled, the API returns an **HTTP 402** response detailing the required USDC amount and the escrow payment endpoint.",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.obscuraonsol.com",
      "description": "Production API Server"
    },
    {
      "url": "http://localhost:3001",
      "description": "Local Development Server"
    }
  ],
  "paths": {
    "/api/orders/metrics": {
      "get": {
        "summary": "Get Marketplace Metrics & Depth",
        "description": "Returns fill rates, volume, and active clearing prices for GPU types.",
        "responses": {
          "200": {
            "description": "Returns active market metrics"
          }
        }
      }
    },
    "/api/orders": {
      "post": {
        "summary": "Commit Order",
        "description": "Submits a commit hash representing a cryptographic bid for a GPU lease.",
        "security": [{ "ApiKeyAuth": [] }],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["gpuType", "commitHash"],
                "properties": {
                  "gpuType": { "type": "string", "example": "NVIDIA H100 80GB" },
                  "commitHash": { "type": "string", "example": "0x3ab5f8b9ec47347fd0b0a1a2f3" }
                }
              }
            }
          }
        },
        "responses": {
          "201": { "description": "Order committed successfully" },
          "401": { "description": "Unauthorized - Missing or invalid API Key" }
        }
      },
      "get": {
        "summary": "List Agent Orders",
        "description": "Lists all programmatic order entries associated with the authenticated wallet.",
        "security": [{ "ApiKeyAuth": [] }],
        "responses": {
          "200": { "description": "Returns array of order entries" }
        }
      }
    },
    "/api/orders/{id}/reveal": {
      "post": {
        "summary": "Reveal Order preimage",
        "description": "Reveals the price rate, quantity, and secret details for verification against the committed hash.",
        "security": [{ "ApiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["priceMicro", "qty", "secret"],
                "properties": {
                  "priceMicro": { "type": "integer", "description": "USDC hourly rate * 1,000,000", "example": 1800000 },
                  "qty": { "type": "integer", "description": "Lease duration in hours", "example": 4 },
                  "secret": { "type": "string", "description": "Client entropy secret", "example": "0x3c2415d8f761be" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Order revealed successfully" },
          "400": { "description": "Invalid reveal parameters" }
        }
      }
    },
    "/api/orders/{id}/build-settle-tx": {
      "post": {
        "summary": "Build Escrow Settlement Transaction",
        "description": "Constructs a base64 serialized transaction for the total lease payment to the escrow service wallet.",
        "security": [{ "ApiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "responses": {
          "200": { "description": "Returns serialized Solana transaction" },
          "400": { "description": "Order details missing or not matched" }
        }
      }
    },
    "/api/orders/{id}/settle": {
      "post": {
        "summary": "Settle Order Payment",
        "description": "Submits a signed Solana transaction signature to verify payment and activate the server lease.",
        "security": [{ "ApiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": ["txSig"],
                "properties": {
                  "txSig": { "type": "string", "description": "Solana transaction signature", "example": "3uUgnzaZmUY73J8G6pZXXYGqvJWy" }
                }
              }
            }
          }
        },
        "responses": {
          "200": { "description": "Order settled and lease activated" },
          "400": { "description": "Payment verification failed" }
        }
      }
    },
    "/api/orders/{id}": {
      "get": {
        "summary": "Retrieve Order Status & Connection (X402)",
        "description": "Queries the current order state. If matched but unpaid, returns **402 Payment Required**. If settled, returns direct SSH connection credentials.",
        "security": [{ "ApiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "responses": {
          "200": {
            "description": "Lease settled. Returns credentials.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "string" },
                    "status": { "type": "string", "example": "settled" },
                    "connection": {
                      "type": "object",
                      "properties": {
                        "host": { "type": "string", "example": "api.obscuraonsol.com" },
                        "port": { "type": "string", "example": "22000" },
                        "username": { "type": "string", "example": "root" },
                        "password": { "type": "string", "example": "x8H2pA9z" }
                      }
                    }
                  }
                }
              }
            }
          },
          "402": {
            "description": "Payment Required. Returns billing specifics.",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": { "type": "string", "example": "payment_required" },
                    "message": { "type": "string", "example": "Payment of 7.2360 USDC required to access credentials." },
                    "amountUsdc": { "type": "number", "example": 7.236 },
                    "escrowWallet": { "type": "string", "example": "FHMr5nLShb3AxFmdqS2dEwdseKFvaic6vyFcCm3Hm6Jn" },
                    "paymentUrl": { "type": "string", "example": "/api/orders/your-order-id/build-settle-tx" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/orders/{id}/cancel": {
      "post": {
        "summary": "Cancel Order",
        "description": "Cancels an unsettled order and removes its matching intent.",
        "security": [{ "ApiKeyAuth": [] }],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "string", "format": "uuid" } }
        ],
        "responses": {
          "200": { "description": "Order cancelled successfully" }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyAuth": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      }
    }
  }
};

export const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Obscura Agent API - Swagger Docs</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" >
  <style>
    html { box-sizing: border-box; overflow:-y-scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; background: #0c0d10; }
    /* Premium dark mode styling for Swagger */
    .swagger-ui { filter: invert(88%) hue-rotate(180deg); }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { color: #ffffff; }
    .swagger-ui .scheme-container { background: transparent; box-shadow: none; border-bottom: 1px solid rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"> </script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"> </script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(swaggerSpec)};

      const ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "BaseLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>
`;
