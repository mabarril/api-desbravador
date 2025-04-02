export default {
  openapi: "3.0.0",
  info: {
    title: "Pathfinder Club Management API",
    version: "1.0.0",
    description: "API for managing a Pathfinder club",
    contact: {
      name: "API Support",
      email: "support@pathfinderclub.org",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "User ID",
          },
          name: {
            type: "string",
            description: "User name",
          },
          email: {
            type: "string",
            format: "email",
            description: "User email",
          },
          role: {
            type: "string",
            enum: ["user", "admin", "director", "leader"],
            description: "User role",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            description: "Update timestamp",
          },
        },
      },
      Pathfinder: {
        type: "object",
        properties: {
          id: {
            type: "integer",
            description: "Pathfinder ID",
          },
          name: {
            type: "string",
            description: "Pathfinder name",
          },
          birth_date: {
            type: "string",
            format: "date",
            description: "Birth date",
          },
          gender: {
            type: "string",
            enum: ["male", "female", "other"],
            description: "Gender",
          },
          email: {
            type: "string",
            format: "email",
            description: "Email address",
          },
          phone: {
            type: "string",
            description: "Phone number",
          },
          address: {
            type: "string",
            description: "Physical address",
          },
          unit_id: {
            type: "integer",
            description: "Unit ID",
          },
          created_at: {
            type: "string",
            format: "date-time",
            description: "Creation timestamp",
          },
          updated_at: {
            type: "string",
            format: "date-time",
            description: "Update timestamp",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "error",
          },
          statusCode: {
            type: "integer",
            example: 400,
          },
          message: {
            type: "string",
            example: "Error message",
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    "/auth/register": {
      post: {
        tags: ["Authentication"],
        summary: "Register a new user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "passwordConfirm"],
                properties: {
                  name: {
                    type: "string",
                    example: "John Doe",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    example: "Password123",
                  },
                  passwordConfirm: {
                    type: "string",
                    format: "password",
                    example: "Password123",
                  },
                  role: {
                    type: "string",
                    enum: ["user", "admin", "director", "leader"],
                    example: "user",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "User registered successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "success",
                    },
                    token: {
                      type: "string",
                    },
                    data: {
                      type: "object",
                      properties: {
                        user: {
                          $ref: "#/components/schemas/User",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Login a user",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                  password: {
                    type: "string",
                    format: "password",
                    example: "Password123",
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "User logged in successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "success",
                    },
                    token: {
                      type: "string",
                    },
                    data: {
                      type: "object",
                      properties: {
                        user: {
                          $ref: "#/components/schemas/User",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
    "/pathfinders": {
      get: {
        tags: ["Pathfinders"],
        summary: "Get all pathfinders",
        responses: {
          200: {
            description: "A list of pathfinders",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "success",
                    },
                    results: {
                      type: "integer",
                    },
                    data: {
                      type: "object",
                      properties: {
                        pathfinders: {
                          type: "array",
                          items: {
                            $ref: "#/components/schemas/Pathfinder",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Pathfinders"],
        summary: "Create a new pathfinder",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "birthDate", "gender"],
                properties: {
                  name: {
                    type: "string",
                    example: "John Doe",
                  },
                  birthDate: {
                    type: "string",
                    format: "date",
                    example: "2010-01-01",
                  },
                  gender: {
                    type: "string",
                    enum: ["male", "female", "other"],
                    example: "male",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    example: "john@example.com",
                  },
                  phone: {
                    type: "string",
                    example: "1234567890",
                  },
                  address: {
                    type: "string",
                    example: "123 Main St",
                  },
                  unitId: {
                    type: "integer",
                    example: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: "Pathfinder created successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "success",
                    },
                    data: {
                      type: "object",
                      properties: {
                        pathfinder: {
                          $ref: "#/components/schemas/Pathfinder",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/Error",
                },
              },
            },
          },
        },
      },
    },
  },
}

