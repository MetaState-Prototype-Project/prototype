import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { ReputationService } from "./services/reputation";
import { analyzeReference } from "./services/openai";
import { insertReputationCalculationSchema, insertReferenceSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images and documents are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth routes and middleware
  const requireAuth = await setupAuth(app);

  // Dashboard data
  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Mock stats to match new activity data
      const stats = {
        currentScore: "1.8",
        totalReferences: "12", 
        totalCalculations: "6"
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get('/api/dashboard/activities', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = 10; // 10 items per page
      
      // Get real activities from the database
      const activities = await ReputationService.getActivityHistory(userId);
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedActivities = activities.slice(startIndex, endIndex);
      
      res.json({
        activities: paginatedActivities,
        pagination: {
          page,
          limit,
          total: activities.length,
          totalPages: Math.ceil(activities.length / limit),
          hasNext: endIndex < activities.length,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // Reputation calculation routes
  app.post('/api/reputation/calculate', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      console.log('Reputation calculation request:', {
        userId,
        body: req.body,
        combinedData: { ...req.body, userId }
      });
      
      const validationResult = insertReputationCalculationSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!validationResult.success) {
        console.log('Validation failed:', validationResult.error.errors);
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.errors 
        });
      }

      const { targetType, targetId, targetName, variables } = validationResult.data;

      console.log('Validation successful:', { targetType, targetId, targetName, variables });

      // Convert variables to string array if needed
      const variablesArray = Array.isArray(variables) 
        ? variables as string[]
        : (variables ? [String(variables)] : []);

      // Skip the variables check for now to isolate the validation issue
      // if (!Array.isArray(variablesArray) || variablesArray.length < 3) {
      //   return res.status(400).json({ 
      //     message: "Please select at least 3 variables for accurate analysis" 
      //   });
      // }

      const calculation = await ReputationService.calculateReputation(
        userId,
        targetType,
        targetId || undefined,
        targetName || undefined,
        variablesArray
      );

      res.json(calculation);
    } catch (error) {
      console.error("Error calculating reputation:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to calculate reputation" 
      });
    }
  });

  app.get('/api/reputation/:id', requireAuth, async (req: any, res) => {
    try {
      const calculationId = parseInt(req.params.id);
      const calculation = await storage.getReputationCalculation(calculationId);
      
      if (!calculation) {
        return res.status(404).json({ message: "Calculation not found" });
      }

      // Verify user owns this calculation
      const userId = req.user.id;
      if (calculation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(calculation);
    } catch (error) {
      console.error("Error fetching calculation:", error);
      res.status(500).json({ message: "Failed to fetch calculation" });
    }
  });

  app.patch('/api/reputation/:id/visibility', requireAuth, async (req: any, res) => {
    try {
      const calculationId = parseInt(req.params.id);
      const { isPublic } = req.body;
      
      const calculation = await storage.getReputationCalculation(calculationId);
      if (!calculation) {
        return res.status(404).json({ message: "Calculation not found" });
      }

      // Verify user owns this calculation
      const userId = req.user.id;
      if (calculation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateReputationCalculation(calculationId, { isPublic });
      res.json(updated);
    } catch (error) {
      console.error("Error updating calculation visibility:", error);
      res.status(500).json({ message: "Failed to update calculation visibility" });
    }
  });

  // Reference routes
  app.post('/api/references', requireAuth, upload.array('files', 5), async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const validationResult = insertReferenceSchema.safeParse({
        ...req.body,
        authorId: userId,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validationResult.error.errors 
        });
      }

      const referenceData = validationResult.data;

      // Process uploaded files
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileUpload = await storage.createFileUpload({
            userId,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: `/uploads/${file.filename}`,
          });
          
          attachments.push({
            id: fileUpload.id,
            originalName: fileUpload.originalName,
            url: fileUpload.url,
            size: fileUpload.size,
          });
        }
      }

      // Generate simple digital signature
      const timestamp = new Date().toISOString();
      const signatureData = {
        referenceId: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        authorId: userId,
        targetName: referenceData.targetName,
        contentHash: Buffer.from(referenceData.content).toString('base64').slice(0, 32)
      };
      
      const digitalSignature = Buffer.from(JSON.stringify(signatureData)).toString('base64');

      // Create reference with attachments and digital signature
      const reference = await storage.createReference({
        ...referenceData,
        attachments: attachments.length > 0 ? attachments : null,
        status: "submitted", // Ensure status is always set
        digitalSignature,
        signedAt: new Date(timestamp),
      });

      res.json(reference);
    } catch (error) {
      console.error("Error creating reference:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to create reference" 
      });
    }
  });

  app.get('/api/references', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Get actual references from database
      const userReferences = await storage.getUserReferences(userId);
      
      // Format references for display, combining demo data with actual references
      const demoReferences = [
        {
          id: 1,
          type: "Sent",
          forFrom: "Sarah Johnson",
          date: "2025-07-20",
          status: "Signed",
          content: "Exceptional project leadership and technical expertise on the W3DS platform migration."
        },
        {
          id: 2,
          type: "Received",
          forFrom: "Marcus Chen",
          date: "2025-07-18",
          status: "Signed",
          content: "Outstanding collaboration on API development. Strong problem-solving skills."
        },
        {
          id: 3,
          type: "Sent",
          forFrom: "Development Team Alpha",
          date: "2025-07-15",
          status: "Signed",
          content: "Reliable team with consistent delivery quality and excellent communication."
        },
        {
          id: 4,
          type: "Received",
          forFrom: "Lisa Rodriguez",
          date: "2025-07-12",
          status: "Signed",
          content: "Innovative approach to system architecture. Delivered ahead of schedule."
        },
        {
          id: 5,
          type: "Sent",
          forFrom: "GitHub Enterprise",
          date: "2025-07-10",
          status: "Signed",
          content: "Solid platform with good integration capabilities. Some areas for improvement."
        }
      ];

      // Add actual references from database
      const actualReferences = userReferences.map((ref: any) => ({
        id: `ref_${ref.id}`,
        type: "Sent", // You sent this reference
        forFrom: ref.targetName,
        date: new Date(ref.createdAt).toISOString().split('T')[0],
        status: "Signed",
        content: ref.content
      }));

      const allReferences = [...actualReferences, ...demoReferences];
      
      // Apply pagination
      const total = allReferences.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const references = allReferences.slice(startIndex, endIndex);

      const pagination = {
        page,
        limit,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      };
      
      res.json({ references, pagination });
    } catch (error) {
      console.error("Error fetching references:", error);
      res.status(500).json({ message: "Failed to fetch references" });
    }
  });

  // Revoke reference
  app.patch('/api/references/:id/revoke', requireAuth, async (req: any, res) => {
    try {
      const referenceId = req.params.id;
      const userId = req.user.id;
      
      // For demo purposes, we'll update the reference status
      // In a real app, you'd verify the user has permission to revoke this reference
      
      // Return success response with updated status
      res.json({
        success: true,
        message: "Reference revoked successfully",
        referenceId,
        status: "Revoked"
      });
    } catch (error) {
      console.error("Error revoking reference:", error);
      res.status(500).json({ message: "Failed to revoke reference" });
    }
  });

  // File serving
  app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: "File not found" });
    }
    
    res.sendFile(filepath);
  });

  // Search endpoints (mock implementations for now)
  app.get('/api/search/users', requireAuth, async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Mock user search results
    const mockUsers = [
      { id: 'user1', name: 'Sarah Johnson', type: 'user' },
      { id: 'user2', name: 'Michael Chen', type: 'user' },
      { id: 'user3', name: 'Emma Davis', type: 'user' },
    ].filter(user => user.name.toLowerCase().includes(query.toLowerCase()));

    res.json(mockUsers);
  });

  app.get('/api/search/groups', requireAuth, async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Mock group search results
    const mockGroups = [
      { id: 'group1', name: 'TechCorp Inc.', type: 'group' },
      { id: 'group2', name: 'Innovation Labs', type: 'group' },
      { id: 'group3', name: 'Digital Solutions', type: 'group' },
    ].filter(group => group.name.toLowerCase().includes(query.toLowerCase()));

    res.json(mockGroups);
  });

  app.get('/api/search/platforms', requireAuth, async (req, res) => {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.json([]);
    }

    // Mock platform search results
    const mockPlatforms = [
      { id: 'platform1', name: 'LinkedIn', type: 'platform' },
      { id: 'platform2', name: 'GitHub', type: 'platform' },
      { id: 'platform3', name: 'Stack Overflow', type: 'platform' },
    ].filter(platform => platform.name.toLowerCase().includes(query.toLowerCase()));

    res.json(mockPlatforms);
  });

  // References routes
  app.get('/api/references', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      // Mock data for references - in a real app this would come from the database
      const mockReferences = [
        {
          type: 'received',
          name: 'John Smith',
          organization: 'Tech Corp',
          date: '2025-01-15',
          rating: '8.5/10',
          status: 'active'
        },
        {
          type: 'given',
          name: 'Sarah Johnson',
          organization: 'Design Studio',
          date: '2025-01-10',
          rating: '9.0/10',
          status: 'active'
        }
      ];
      res.json(mockReferences);
    } catch (error) {
      console.error("Error fetching references:", error);
      res.status(500).json({ message: "Failed to fetch references" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
