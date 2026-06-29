export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  timestamp: string;
  path: string;
}

export interface IApiError {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    error: string;
  };
  timestamp: string;
  path: string;
}
