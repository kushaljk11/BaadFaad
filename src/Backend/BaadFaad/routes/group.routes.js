/**
 * @fileoverview Group Management Routes
 * @description Express router for persistent expense-sharing group CRUD operations.
 *              Groups allow users to organize recurring bill-splitting circles.
 *
 * Routes:
 *  POST   /                          - Create a new group
 *  GET    /                          - List all groups
 *  GET    /:groupId                  - Get group by ID
 *  PATCH  /:groupId                  - Update group details
 *  POST   /:groupId/join             - Join a group via QR code / invite link
 *  POST   /:groupId/members          - Add a member to a group
 *  DELETE /:groupId/members/:userId  - Remove a member from a group
 *  DELETE /:groupId                  - Deactivate (soft-delete) a group
 *
 * @module routes/group.routes
 */
import express from 'express';
import {
  addMember,
  createGroup,
  deactivateGroup,
  getGroupById,
  getGroupBySplitId,
  getGroups,
  joinGroup,
  removeMember,
  updateGroup,
} from '../controllers/group.controller.js';
import { protectStrict, requireOAuthUser } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { addMemberBody, groupCreateBody, groupIdParams, groupMemberParams, groupUpdateBody, invitationJoinBody, paginationQuery, splitIdParams } from '../validation/schemas.js';

const router = express.Router();

router.post('/', protectStrict, requireOAuthUser, validate({ body: groupCreateBody }), createGroup);
router.get('/', validate({ query: paginationQuery }), getGroups);
router.get('/by-split/:splitId', validate({ params: splitIdParams }), getGroupBySplitId);
router.get('/:groupId', validate({ params: groupIdParams }), getGroupById);
router.patch('/:groupId', validate({ params: groupIdParams, body: groupUpdateBody }), updateGroup);
router.post('/:groupId/join', protectStrict, requireOAuthUser, validate({ params: groupIdParams, body: invitationJoinBody }), joinGroup);
router.post('/:groupId/members', validate({ params: groupIdParams, body: addMemberBody }), addMember);
router.delete('/:groupId/members/:userId', validate({ params: groupMemberParams }), removeMember);
router.delete('/:groupId', validate({ params: groupIdParams }), deactivateGroup);

export default router;
