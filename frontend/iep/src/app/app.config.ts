import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { Router } from '@angular/router';

// Functional interceptor for JWT authentication
export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  // Get the auth token from the service
  const authToken = authService.getToken();
  
  // Clone the request and add the authorization header if we have a token
  let authReq = req;
  if (authToken && !req.url.includes('/api/login')) {
    authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${authToken}`)
    });
  }

  // Send the cloned request with the header to the next handler
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // If we get a 401 or 403, the token might be expired
      if (error.status === 401 || error.status === 403) {
        // Log out the user and redirect to login
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
