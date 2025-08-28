import type { Request, Response, NextFunction } from "express";
import type { User } from "@shared/schema";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface User {
      role: 'super_admin' | 'agency' | 'client';
      agencyId?: string;
    }
  }
}

// Extend Express Request to include role information
export interface AuthenticatedRequest extends Request {
  user: User & { agencyId?: string | null };
  userRole: 'super_admin' | 'agency' | 'client';
  agencyId?: string | null;
  clientId?: string | null;
}

/**
 * Base authentication middleware - ensures user is logged in
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized - Login required" });
  }
  next();
};

/**
 * Role-based access control middleware factory
 */
export const requireRole = (...allowedRoles: Array<'super_admin' | 'agency' | 'client'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const user = req.user as User;
    
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        message: "Forbidden - Insufficient permissions",
        required: allowedRoles,
        current: user?.role 
      });
    }
    
    // Attach role info to request for convenience
    authReq.userRole = user.role;
    authReq.agencyId = user.agencyId || undefined;
    
    next();
  };
};

/**
 * Super Admin only access
 */
export const requireSuperAdmin = requireRole('super_admin');

/**
 * Agency/Agent only access
 */
export const requireAgency = requireRole('agency');

/**
 * Client only access
 */
export const requireClient = requireRole('client');

/**
 * Agency or Super Admin access (for agency management)
 */
export const requireAgencyOrSuperAdmin = requireRole('super_admin', 'agency');

/**
 * Any authenticated user
 */
export const requireAnyRole = requireRole('super_admin', 'agency', 'client');

/**
 * Data isolation middleware - ensures agencies can only access their own data
 */
export const requireAgencyAccess = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const user = req.user as User;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Super admins have access to all agencies
  if (user.role === 'super_admin') {
    return next();
  }
  
  // Agencies can only access their own data
  if (user.role === 'agency') {
    const agency = await storage.getAgencyByOwnerId(user.id);
    if (!agency) {
      return res.status(403).json({ message: "No associated agency found" });
    }
    authReq.agencyId = agency.id;
    return next();
  }
  
  return res.status(403).json({ message: "Access denied" });
};

/**
 * Client data isolation - ensures clients can only access their own data
 */
export const requireClientAccess = async (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const user = req.user as User;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Super admins have access to all client data
  if (user.role === 'super_admin') {
    return next();
  }
  
  // Agencies can access their clients' data
  if (user.role === 'agency') {
    const agency = await storage.getAgencyByOwnerId(user.id);
    if (!agency) {
      return res.status(403).json({ message: "No associated agency found" });
    }
    authReq.agencyId = agency.id;
    return next();
  }
  
  // Clients can only access their own data
  if (user.role === 'client') {
    const client = await storage.getClientByUserId(user.id);
    if (!client) {
      return res.status(403).json({ message: "No associated client found" });
    }
    authReq.clientId = client.id;
    authReq.agencyId = client.agencyId;
    return next();
  }
  
  return res.status(403).json({ message: "Access denied" });
};

/**
 * Resource quota enforcement middleware
 */
export const enforceResourceQuotas = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User;
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Skip quota enforcement for super admins
  if (user.role === 'super_admin') {
    return next();
  }
  
  try {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    if (user.role === 'agency') {
      const agency = await storage.getAgencyByOwnerId(user.id);
      if (!agency) {
        return res.status(403).json({ message: "No associated agency found" });
      }
      
      const usage = await storage.getResourceUsage(agency.id, year, month);
      if (usage && (usage.charactersUsed || 0) >= (agency.masterCharacterQuota || 0)) {
        return res.status(429).json({ 
          message: "Monthly character quota exceeded",
          quota: agency.masterCharacterQuota,
          used: usage.charactersUsed || 0
        });
      }
    }
    
    if (user.role === 'client') {
      const client = await storage.getClientByUserId(user.id);
      if (!client) {
        return res.status(403).json({ message: "No associated client found" });
      }
      
      const usage = await storage.getResourceUsage(client.id, year, month);
      if (usage && (usage.charactersUsed || 0) >= (client.characterQuota || 0)) {
        return res.status(429).json({ 
          message: "Monthly character quota exceeded",
          quota: client.characterQuota,
          used: usage.charactersUsed || 0
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('Error enforcing resource quotas:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Middleware to validate agency ownership of a resource
 */
export const validateResourceOwnership = (resourceType: 'client' | 'plan' | 'agent') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const user = req.user as User;
    const resourceId = req.params.id || req.body.id;
    
    if (!user || !resourceId) {
      return res.status(400).json({ message: "Invalid request" });
    }
    
    // Super admins can access any resource
    if (user.role === 'super_admin') {
      return next();
    }
    
    try {
      if (user.role === 'agency') {
        const agency = await storage.getAgencyByOwnerId(user.id);
        if (!agency) {
          return res.status(403).json({ message: "No associated agency found" });
        }
        
        // Validate ownership based on resource type
        switch (resourceType) {
          case 'client':
            const client = await storage.getClient(resourceId);
            if (!client || client.agencyId !== agency.id) {
              return res.status(403).json({ message: "Resource not found or access denied" });
            }
            break;
          case 'plan':
            const plan = await storage.getAgencyPlan(resourceId);
            if (!plan || plan.agencyId !== agency.id) {
              return res.status(403).json({ message: "Resource not found or access denied" });
            }
            break;
        }
        
        authReq.agencyId = agency.id;
      }
      
      next();
    } catch (error) {
      console.error('Error validating resource ownership:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

/**
 * Helper function to check if user has role
 */
export const hasRole = (user: User, role: 'super_admin' | 'agency' | 'client'): boolean => {
  return user.role === role;
};

/**
 * Helper function to check if user has any of the specified roles
 */
export const hasAnyRole = (user: User, roles: Array<'super_admin' | 'agency' | 'client'>): boolean => {
  return roles.includes(user.role);
};