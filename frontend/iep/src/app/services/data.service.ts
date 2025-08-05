import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError, map, of } from 'rxjs';
import { MatrixItem } from '../models/matrix-item';

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getMatrixItems(): Observable<MatrixItem[]> {
    return this.http.get<MatrixItem[]>(`${this.apiUrl}/matrix`);
  }

  addMatrixItem(item: MatrixItem): Observable<MatrixItem> {
    return this.http.post<MatrixItem>(`${this.apiUrl}/matrix`, item);
  }

  updateMatrixItem(item: MatrixItem): Observable<MatrixItem> {
    return this.http.put<MatrixItem>(`${this.apiUrl}/matrix/${item.id}`, item);
  }
  
  deleteMatrixItem(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/matrix/${id}`).pipe(
      catchError(this.handleError)
    );
  }
  
  checkApiExists(api: string, excludeId?: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/matrix/check-api`, {
      params: { 
        api, 
        ...(excludeId !== undefined && { excludeId: excludeId.toString() })
      }
    });
  }
  
  getMatrixStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/matrix/stats`);
  }
  
  /**
   * Gets the module to submodule mapping from the backend
   * This is used to filter the submodule dropdown based on selected module
   */
  getModuleMapping(): Observable<{[key: string]: string[]}> {
    //console.log('Fetching module mapping from backend...');
    return this.http.get<{[key: string]: string[]}>(`${this.apiUrl}/modules/mapping`).pipe(
      map(response => {
       
        // Handle empty response case
        if (!response || Object.keys(response).length === 0) {
          console.warn('Empty module mapping received from server');
          // Return a default mapping if the response is empty
          return this.getDefaultModuleMapping();
        }
        //console.log(response);
        return response;
      }),
      catchError(error => {
        console.error('Error fetching module mapping:', error);
        
        // Return a default mapping on error to prevent UI from breaking
        console.log('Using fallback module mapping');
        return of(this.getDefaultModuleMapping());
      })
    );
  }

  /**
   * Provides a default module mapping as fallback when the API fails
   * This ensures the UI doesn't break even if the backend is having issues
   */
  private getDefaultModuleMapping(): {[key: string]: string[]} {
    return {
      'DIGITAL': ['CAD', 'SUPPORT TICKET', 'PLATFORM USAGE', 'RULES STREAM'],
      'ENGINEERING': ['IFC', 'MOM', 'AS BUILT', 'REFERENCE FINDER', 'TOOL', 'DESIGN REVIEW'],
      'GLOBAL OPERATIONS': ['GLOBAL OPERATIONS'],
      'NPD': ['NPD'],
      'OPERATION': ['Do vs Buy', 'ISPO', 'VDR', 'VDRREV', 'VDR FINALIZATION'],
      'PROJECT INFO': ['BOM', 'PROJECT INFO', 'ITO Information', 'PROJECT SUMMARY'],
      'QUALITY': ['NCR', 'NCM/CCM', 'ECN', 'ECR', 'COQ'],
      'GENERAL': ['CONTROL PANEL', 'CONTRACTS', 'MY REQUEST', 'CHANGE DASHBOARD', 'CHAT']
    };
  }
  
  exportToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/matrix/export`, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }
  
  /**
   * Exports only the filtered data to Excel
   * This method sends the filtered data to the backend for Excel generation
   */
  exportFilteredDataToExcel(filteredData: MatrixItem[]): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/matrix/export-filtered`, filteredData, {
      responseType: 'blob'
    }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server error: ${error.status}. ${error.error?.message || ''}`;
    }
    
    return throwError(() => new Error(errorMessage));
  }
}
