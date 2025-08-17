// User types
export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: string;
}

// Image types
export interface ImageMetadata {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  url: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
  tags?: string[];
  description?: string;
}

export interface ImageUploadResponse {
  image: ImageMetadata;
  message: string;
}

export interface ImageProcessingOptions {
  resize?: {
    width: number;
    height: number;
    maintainAspectRatio?: boolean;
  };
  filter?: 'blur' | 'sharpen' | 'grayscale' | 'sepia' | 'enhance';
  rotate?: number;
  quality?: number;
}

// System types
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  timestamp: string;
  service: string;
  version?: string;
  uptime?: number;
  details?: Record<string, any>;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'down';
  services: {
    api: ServiceHealth;
    auth: ServiceHealth;
    image: ServiceHealth;
  };
  timestamp: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Documentation types
export interface DocumentationSection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  href: string;
  category: 'getting-started' | 'apis' | 'deployment' | 'monitoring' | 'security';
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: Parameter[];
  requestBody?: RequestBodySchema;
  responses: ResponseSchema[];
  examples?: ApiExample[];
}

export interface Parameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  description: string;
  example?: any;
}

export interface RequestBodySchema {
  type: 'json' | 'form-data' | 'multipart';
  schema: Record<string, any>;
  example?: any;
}

export interface ResponseSchema {
  status: number;
  description: string;
  schema?: Record<string, any>;
  example?: any;
}

export interface ApiExample {
  title: string;
  description: string;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    body: any;
  };
}

// Architecture diagram types
export interface ArchitectureComponent {
  id: string;
  name: string;
  type: 'service' | 'database' | 'storage' | 'monitor' | 'security';
  description: string;
  technology: string;
  port?: number;
  dependencies: string[];
  status: 'running' | 'stopped' | 'error' | 'unknown';
}

// Monitoring types
export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    fill?: boolean;
  }[];
}

// Navigation types
export interface NavigationItem {
  name: string;
  href: string;
  icon?: string;
  description?: string;
  category?: string;
  external?: boolean;
}

// UI Component types
export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}