import { Injectable, ExecutionContext, ForbiddenException, CanActivate } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Define required roles for warehouse access
    const requiredRoles = ['admin', 'menadzer', 'sef', 'magacioner'];
    
    if (!this.authService.hasRole(user, requiredRoles)) {
      throw new ForbiddenException('Access denied. Required roles: admin, menadzer, sef, magacioner');
    }

    return true;
  }
}

@Injectable()
export class ReceivingRolesGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Required roles for receiving access
    // komercijalista and logistika can create, but limited access
    const requiredRoles = ['admin', 'menadzer', 'sef', 'magacioner', 'komercijalista', 'logistika'];
    
    if (!this.authService.hasRole(user, requiredRoles)) {
      throw new ForbiddenException('Access denied. Required roles for receiving: admin, menadzer, sef, magacioner, komercijalista, logistika');
    }

    return true;
  }
}
