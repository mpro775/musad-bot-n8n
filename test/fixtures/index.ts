// Test fixtures and mock data

export const mockUsers = {
  validUser: {
    _id: '507f1f77bcf86cd799439011',
    email: 'user@example.com',
    username: 'testuser',
    password: '$2b$10$hashedpassword',
    isActive: true,
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  adminUser: {
    _id: '507f1f77bcf86cd799439012',
    email: 'admin@example.com',
    username: 'admin',
    password: '$2b$10$hashedpassword',
    isActive: true,
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  inactiveUser: {
    _id: '507f1f77bcf86cd799439013',
    email: 'inactive@example.com',
    username: 'inactive',
    password: '$2b$10$hashedpassword',
    isActive: false,
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

export const mockJwtTokens = {
  validToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTY0MTA4MTYwMH0.mock',
  expiredToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MDdmMWY3N2JjZjg2Y2Q3OTk0MzkwMTEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTY0MDk5NTIwMH0.expired',
  invalidToken: 'invalid.token.here',
};

export const mockApiResponses = {
  success: {
    status: 'success',
    message: 'Operation completed successfully',
    data: {},
  },
  error: {
    status: 'error',
    message: 'An error occurred',
    error: 'Internal server error',
  },
  validationError: {
    status: 'error',
    message: 'Validation failed',
    errors: [
      {
        field: 'email',
        message: 'Email is required',
      },
    ],
  },
};

export const mockPaginationResponse = {
  data: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
};

export const mockDatabaseEntities = {
  conversation: {
    _id: '507f1f77bcf86cd799439020',
    userId: '507f1f77bcf86cd799439011',
    title: 'Test Conversation',
    messages: [],
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  message: {
    _id: '507f1f77bcf86cd799439021',
    conversationId: '507f1f77bcf86cd799439020',
    content: 'Test message content',
    role: 'user',
    timestamp: new Date('2024-01-01'),
  },
  document: {
    _id: '507f1f77bcf86cd799439022',
    userId: '507f1f77bcf86cd799439011',
    filename: 'test-document.pdf',
    originalName: 'Test Document.pdf',
    mimeType: 'application/pdf',
    size: 1024,
    path: '/uploads/test-document.pdf',
    isProcessed: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
};

export const mockExternalApiResponses = {
  openai: {
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'This is a mock OpenAI response',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  },
  embedding: {
    data: [
      {
        embedding: new Array(1536).fill(0.1),
        index: 0,
      },
    ],
    usage: {
      prompt_tokens: 5,
      total_tokens: 5,
    },
  },
};

export const mockValidationSchemas = {
  createUser: {
    email: 'test@example.com',
    username: 'testuser',
    password: 'StrongPassword123!',
  },
  updateUser: {
    username: 'updateduser',
  },
  createConversation: {
    title: 'New Conversation',
  },
  sendMessage: {
    content: 'Hello, this is a test message',
  },
};

export const mockErrorResponses = {
  badRequest: {
    statusCode: 400,
    message: 'Bad Request',
    error: 'Bad Request',
  },
  unauthorized: {
    statusCode: 401,
    message: 'Unauthorized',
    error: 'Unauthorized',
  },
  forbidden: {
    statusCode: 403,
    message: 'Forbidden',
    error: 'Forbidden',
  },
  notFound: {
    statusCode: 404,
    message: 'Not Found',
    error: 'Not Found',
  },
  internalServerError: {
    statusCode: 500,
    message: 'Internal Server Error',
    error: 'Internal Server Error',
  },
};
