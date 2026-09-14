export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "10xCards API",
    version: "1.0.0",
    description:
      "REST API for 10xCards — flashcard learning app with AI generation, spaced repetition (FSRS), and set sharing.",
  },
  servers: [
    { url: "http://localhost:4321", description: "Local development" },
    { url: "https://10xcards.pl", description: "Production" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey" as const,
        in: "cookie" as const,
        name: "sb-localhost-auth-token",
        description: "Supabase auth cookie (set automatically by sign-in)",
      },
    },
    schemas: {
      Error: {
        type: "object",
        description:
          "Error response. The `error` field contains an uppercase error code (e.g. `UNAUTHORIZED`, `VALIDATION_FAILED`).",
        properties: { error: { type: "string", example: "UNAUTHORIZED" } },
        required: ["error"],
      },
      ValidationError: {
        type: "object",
        properties: {
          error: { type: "string", example: "VALIDATION_FAILED" },
          details: { type: "array", items: { type: "string" } },
        },
        required: ["error", "details"],
      },
      FlashcardSet: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          name: { type: "string" },
          share_token: { type: "string", format: "uuid", nullable: true },
          last_opened_at: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: ["id", "user_id", "name", "share_token", "last_opened_at", "created_at", "updated_at"],
      },
      Flashcard: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          set_id: { type: "string", format: "uuid" },
          front: { type: "string" },
          back: { type: "string" },
          due: { type: "string", format: "date-time" },
          stability: { type: "number" },
          difficulty: { type: "number" },
          elapsed_days: { type: "integer" },
          scheduled_days: { type: "integer" },
          learning_steps: { type: "integer" },
          reps: { type: "integer" },
          lapses: { type: "integer" },
          state: {
            type: "integer",
            enum: [0, 1, 2, 3],
            description: "FSRS State: 0=New, 1=Learning, 2=Review, 3=Relearning",
          },
          last_review: { type: "string", format: "date-time", nullable: true },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
        required: [
          "id",
          "set_id",
          "front",
          "back",
          "due",
          "stability",
          "difficulty",
          "elapsed_days",
          "scheduled_days",
          "learning_steps",
          "reps",
          "lapses",
          "state",
          "last_review",
          "created_at",
          "updated_at",
        ],
      },
      FlashcardContent: {
        type: "object",
        properties: {
          front: { type: "string", minLength: 1, maxLength: 1000 },
          back: { type: "string", minLength: 1, maxLength: 1000 },
        },
        required: ["front", "back"],
      },
      SetName: { type: "string", minLength: 1, maxLength: 200 },
      Rating: {
        type: "integer",
        enum: [1, 2, 3, 4],
        description: "FSRS rating: 1=Again, 2=Hard, 3=Good, 4=Easy",
      },
      DictionaryEntry: {
        type: "object",
        description:
          'A single dictionary sense for a looked-up word. For Cambridge (EN) lookups, `dictionaryRegion` is "UK"/"US" and `info` carries the CEFR level/usage labels. For Pons DE→PL lookups (`/api/dict/de/{word}`), `dictionaryRegion` is always `null` and `info` carries the Pons sense gloss; `examples` carries up to 6 German↔Polish example pairs joined by ` — ` (Pons `depl` example rows grouped under each sense).',
        properties: {
          definition: { type: "string", example: "Clever and difficult, sometimes in a bad way." },
          type: { type: "string", nullable: true, description: "Part of speech (e.g. noun, verb, adjective)" },
          dictionaryRegion: { type: "string", enum: ["UK", "US"], nullable: true },
          info: {
            type: "string",
            nullable: true,
            description: "CEFR level and/or usage labels (e.g. C1, formal, literary)",
          },
          examples: {
            type: "array",
            items: { type: "string" },
            description:
              "Up to 2 example sentences (Cambridge) or up to 6 German↔Polish example pairs joined by ` — ` (Pons DE→PL)",
          },
        },
        required: ["definition", "type", "dictionaryRegion", "info", "examples"],
      },
    },
  },
  paths: {
    "/api/dict/{word}": {
      parameters: [
        {
          name: "word",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "English word or phrase to look up (spaces are normalized to hyphens, case-insensitive)",
        },
      ],
      get: {
        summary: "Look up a word in the Cambridge Dictionary",
        description:
          "Live-scrapes dictionary.cambridge.org for UK+US definitions, part of speech, CEFR level/usage labels, and up to 2 examples per sense. No cache — every request scrapes live. Rate-limited to 30 requests per minute per user. Also used internally by the AI generation pipeline (`POST /api/sets/{id}/generate`) via OpenRouter function-calling.",
        tags: ["Dictionary"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Lookup succeeded. `entries` is empty when the word is unknown.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    word: { type: "string" },
                    entries: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DictionaryEntry" },
                    },
                  },
                  required: ["word", "entries"],
                },
              },
            },
          },
          "400": {
            description: "Missing or empty word parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded (30 per minute)",
            headers: {
              "Retry-After": {
                schema: { type: "string", example: "60" },
                description: "Seconds until rate limit resets",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "502": {
            description: "Cambridge Dictionary upstream unavailable (network/timeout)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/dict/de/{word}": {
      parameters: [
        {
          name: "word",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "German word or phrase to look up (spaces are normalized to hyphens, case-insensitive)",
        },
      ],
      get: {
        summary: "Look up a German word in the Pons DE→PL dictionary",
        description:
          "Calls the Pons Online Dictionary API (`l=depl`) for Polish translations, part of speech, and the German sense gloss. Unlike `/api/dict/{word}` (Cambridge), responses are cached for 30 days in the `AI_RATE_LIMIT` KV namespace under `pons:de:v2:<word>` — repeat lookups are cache hits and do not consume the shared 1000/month Pons quota. Shares the same 30 requests/minute per-user rate limit as the Cambridge endpoint. Also used internally by the AI generation pipeline (`POST /api/sets/{id}/generate`) via the `lookup_word_de` OpenRouter tool. Pons `depl` example rows are grouped as up to 6 German↔Polish ` — ` pairs per sense in `examples`; `dictionaryRegion` is always `null`.",
        tags: ["Dictionary"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Lookup succeeded. `entries` is empty when the word is unknown (Pons 204/404).",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    word: { type: "string" },
                    entries: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DictionaryEntry" },
                    },
                  },
                  required: ["word", "entries"],
                },
              },
            },
          },
          "400": {
            description: "Missing or empty word parameter",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded (30 per minute, shared with Cambridge lookup)",
            headers: {
              "Retry-After": {
                schema: { type: "string", example: "60" },
                description: "Seconds until rate limit resets",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "502": {
            description:
              "Pons API unavailable (network/timeout/quota exhausted/secret missing). Errors are never cached.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        summary: "Register a new account",
        tags: ["Auth"],
        requestBody: {
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 6 },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "302": {
            description: "Redirect to /auth/confirm-email on success, or /auth/signup?error=... on failure",
          },
        },
      },
    },
    "/api/auth/signin": {
      post: {
        summary: "Sign in with email and password",
        tags: ["Auth"],
        requestBody: {
          content: {
            "application/x-www-form-urlencoded": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          "302": {
            description: "Redirect to / on success, or /auth/signin?error=... on failure",
          },
        },
      },
    },
    "/api/auth/signout": {
      post: {
        summary: "Sign out the current user",
        tags: ["Auth"],
        responses: {
          "302": { description: "Redirect to /" },
        },
      },
    },
    "/api/auth/change-password": {
      post: {
        summary: "Change the current user's password",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  currentPassword: { type: "string", minLength: 1 },
                  newPassword: { type: "string", minLength: 6 },
                },
                required: ["currentPassword", "newPassword"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Password changed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized or current password incorrect",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/auth/delete-account": {
      post: {
        summary: "Delete the current user's account",
        tags: ["Auth"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  confirmation: {
                    type: "string",
                    const: "DELETE",
                    description: 'Must be the literal string "DELETE"',
                  },
                  currentPassword: { type: "string", minLength: 1 },
                },
                required: ["confirmation", "currentPassword"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Account deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized or current password incorrect",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets": {
      get: {
        summary: "List all flashcard sets for the current user",
        tags: ["Sets"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "List of flashcard sets",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/FlashcardSet" },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        summary: "Create a new flashcard set",
        tags: ["Sets"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { $ref: "#/components/schemas/SetName" } },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created set",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FlashcardSet" },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      patch: {
        summary: "Rename a flashcard set",
        tags: ["Sets"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { name: { $ref: "#/components/schemas/SetName" } },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Renamed set",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FlashcardSet" },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete a flashcard set",
        tags: ["Sets"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Set deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/flashcards": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      get: {
        summary: "Get a set with all its flashcards",
        description: "Also updates last_opened_at on the set as a side effect",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Set with flashcards",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    set: { $ref: "#/components/schemas/FlashcardSet" },
                    flashcards: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Flashcard" },
                    },
                  },
                  required: ["set", "flashcards"],
                },
              },
            },
          },
          "400": {
            description: "Missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/flashcards/batch": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      post: {
        summary: "Create multiple flashcards in a set at once",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  flashcards: {
                    type: "array",
                    items: { $ref: "#/components/schemas/FlashcardContent" },
                    minItems: 1,
                    maxItems: 50,
                  },
                },
                required: ["flashcards"],
              },
            },
          },
        },
        responses: {
          "201": {
            description:
              "Flashcards created. Duplicates whose front already exists in the set are silently skipped and reported in skippedCount/skippedFronts.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Flashcard" },
                    },
                    count: { type: "integer" },
                    skippedCount: {
                      type: "integer",
                      description: "Number of flashcards skipped because their front already exists in the set",
                    },
                    skippedFronts: {
                      type: "array",
                      items: { type: "string" },
                      description: "Front texts that were skipped due to duplication",
                    },
                  },
                  required: ["data", "count"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/due-cards": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      get: {
        summary: "Get due flashcards for spaced repetition review",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Due cards and next due date",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cards: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Flashcard" },
                    },
                    nextDue: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                      description: "Next upcoming card due date if no cards currently due",
                    },
                  },
                  required: ["cards", "nextDue"],
                },
              },
            },
          },
          "400": {
            description: "Missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/generate": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      post: {
        summary: "Generate flashcard proposals using AI",
        description: "Rate-limited to 1 request per hour. Uses the user's custom AI prompt if set.",
        tags: ["AI"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    minLength: 10,
                    maxLength: 8000,
                    description: "Source text to generate flashcards from",
                  },
                  count: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    description: "Number of flashcards to generate (defaults to 5 or user preference)",
                  },
                },
                required: ["text"],
              },
            },
          },
        },
        responses: {
          "200": {
            description:
              "Generated flashcard proposals. Proposals whose front already exists in the set are removed and reported in removedCount/removedFronts.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    flashcards: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          front: { type: "string" },
                          back: { type: "string" },
                        },
                        required: ["front", "back"],
                      },
                    },
                    removedCount: {
                      type: "integer",
                      description: "Number of proposals removed because their front already exists in the set",
                    },
                    removedFronts: {
                      type: "array",
                      items: { type: "string" },
                      description: "Front texts that were removed due to duplication",
                    },
                  },
                  required: ["flashcards", "removedCount", "removedFronts"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "422": {
            description: "AI could not parse the text or produced no proposals",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    kind: {
                      type: "string",
                      enum: ["parseError", "noProposals"],
                    },
                  },
                  required: ["error", "kind"],
                },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded (1 per hour)",
            headers: {
              "Retry-After": {
                schema: { type: "string", example: "3600" },
                description: "Seconds until rate limit resets",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "AI not configured or server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "502": {
            description: "Upstream AI API error",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    kind: { type: "string", enum: ["apiError"] },
                  },
                  required: ["error", "kind"],
                },
              },
            },
          },
          "504": {
            description: "AI request timed out",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    error: { type: "string" },
                    kind: { type: "string", enum: ["timeout"] },
                  },
                  required: ["error", "kind"],
                },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/share": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      get: {
        summary: "Get the share token for a set",
        tags: ["Sharing"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Share token (null if sharing not activated)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    share_token: {
                      type: "string",
                      format: "uuid",
                      nullable: true,
                    },
                  },
                  required: ["share_token"],
                },
              },
            },
          },
          "400": {
            description: "Missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        summary: "Activate or get a share token for a set",
        description: "Atomically generates a UUID share token if one does not already exist",
        tags: ["Sharing"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Share token",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    share_token: { type: "string", format: "uuid" },
                  },
                  required: ["share_token"],
                },
              },
            },
          },
          "400": {
            description: "Missing set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/flashcards": {
      post: {
        summary: "Create a single flashcard",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  set_id: { type: "string", format: "uuid" },
                  front: { type: "string", minLength: 1, maxLength: 1000 },
                  back: { type: "string", minLength: 1, maxLength: 1000 },
                },
                required: ["set_id", "front", "back"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created flashcard",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Flashcard" },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or duplicate front in the set",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found or not owned by user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/flashcards/{id}": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Flashcard UUID",
        },
      ],
      patch: {
        summary: "Update a flashcard's front and back",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/FlashcardContent" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated flashcard",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Flashcard" },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or missing flashcard ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Flashcard not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete a flashcard",
        tags: ["Flashcards"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Flashcard deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Missing flashcard ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Flashcard not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/reviews": {
      post: {
        summary: "Submit a flashcard review (spaced repetition)",
        tags: ["Reviews"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  flashcardId: { type: "string", format: "uuid" },
                  grade: { $ref: "#/components/schemas/Rating" },
                },
                required: ["flashcardId", "grade"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Review recorded",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Flashcard not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sets/{id}/reset-progress": {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
          description: "Set UUID",
        },
      ],
      post: {
        summary: "Reset all learning progress for a set",
        description:
          "Atomically resets FSRS state on every flashcard in the set to defaults (all cards become due) and deletes the set's review history. Session activity logs are preserved. Ownership-guarded — only the set owner can reset.",
        tags: ["Reviews"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Progress reset",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Invalid set ID",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found or not owned by user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/share/claim": {
      post: {
        summary: "Claim a shared set by token",
        description:
          "Clones the shared set into the current user's account. Idempotent — re-claiming returns the same cloned set.",
        tags: ["Sharing"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { token: { type: "string", format: "uuid" } },
                required: ["token"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Set claimed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    cloned_set_id: { type: "string", format: "uuid" },
                    already_claimed: { type: "boolean" },
                  },
                  required: ["cloned_set_id", "already_claimed"],
                },
              },
            },
          },
          "400": {
            description: "Invalid token format or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Share token not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/sessions": {
      post: {
        summary: "Log a study session",
        tags: ["Sessions"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  setId: { type: "string", format: "uuid" },
                  startedAt: { type: "string", format: "date-time" },
                  endedAt: { type: "string", format: "date-time" },
                },
                required: ["setId", "startedAt", "endedAt"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Session logged",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed, invalid JSON, or endedAt before startedAt",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "404": {
            description: "Set not found (or not owned by the caller)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/api/user-voice": {
      get: {
        summary: "Get the current user's front/back speech voices",
        tags: ["User Settings"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "The account's voice pair (defaults applied when unset)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    front: { type: "string", description: "Voice id for the front side" },
                    back: { type: "string", description: "Voice id for the back side" },
                  },
                  required: ["front", "back"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      put: {
        summary: "Upsert the user's front/back speech voices",
        tags: ["User Settings"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  front: { type: "string", description: "Voice id from the supported voice catalog" },
                  back: { type: "string", description: "Voice id from the supported voice catalog" },
                },
                required: ["front", "back"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Voices saved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { front: { type: "string" }, back: { type: "string" } },
                  required: ["front", "back"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": {
            description: "Server error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/tts": {
      post: {
        summary: "Synthesize speech for a card side",
        description:
          "Synthesizes the given text with the given catalog voice via Google Cloud Text-to-Speech and returns MP3 audio. Responses are edge-cached (keyed on a hash of text+voice) and rate-limited per user; cache hits neither consume quota nor count against the limit. Text is capped at 300 characters.",
        tags: ["TTS"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  text: { type: "string", minLength: 1, maxLength: 1000 },
                  voice: { type: "string", description: "Voice id from the supported voice catalog" },
                },
                required: ["text", "voice"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "MP3 audio",
            content: { "audio/mpeg": { schema: { type: "string", format: "binary" } } },
          },
          "400": {
            description: "Validation failed (text too long / invalid voice) or invalid JSON",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationError" } } },
          },
          "401": {
            description: "Unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "429": {
            description: "Rate limit exceeded",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "500": {
            description: "Text-to-speech is not configured",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "502": {
            description: "Upstream provider error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          "504": {
            description: "Synthesis timed out",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/user-prompt": {
      get: {
        summary: "Get the current user's AI prompt settings",
        tags: ["User Settings"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "User prompt settings",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    prompt: { type: "string", nullable: true },
                    flashcard_count: { type: "integer", nullable: true },
                  },
                  required: ["prompt", "flashcard_count"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      put: {
        summary: "Upsert the user's AI prompt and preferred flashcard count",
        tags: ["User Settings"],
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  prompt: { type: "string", minLength: 1, maxLength: 10000 },
                  flashcard_count: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    nullable: true,
                    description: "Preferred number of flashcards per AI generation",
                  },
                },
                required: ["prompt"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Prompt saved",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    prompt: { type: "string" },
                    flashcard_count: { type: "integer", nullable: true },
                  },
                  required: ["prompt", "flashcard_count"],
                },
              },
            },
          },
          "400": {
            description: "Validation failed or invalid JSON",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValidationError" },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        summary: "Delete the user's AI prompt settings",
        tags: ["User Settings"],
        security: [{ cookieAuth: [] }],
        responses: {
          "200": {
            description: "Prompt deleted",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { success: { type: "boolean" } },
                  required: ["success"],
                },
              },
            },
          },
          "401": {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
          "500": {
            description: "Server error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
  },
} as const;
