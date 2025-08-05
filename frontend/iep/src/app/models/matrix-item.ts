export interface MatrixItem {
  id?: number;
  module: string;
  subModule: string;
  functionality?: string;
  dependencyModule: string;  // Changed from subTask to match backend
  dependantFunctionality: string;  // Changed from dependency to match backend
  api: string;
}
