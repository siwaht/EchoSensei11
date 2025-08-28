# Bug Fixes TODO

## ✅ Completed
- [x] Fix missing ID generation in database operations
  - Added generateId() helper function
  - All insert operations now generate unique IDs with prefixes
  - Fixed in server/storage.ts

## 🔧 In Progress
- [ ] Fix undefined ragConfiguration variable in routes.ts
- [x] Fix incorrect deleteAgent parameter order
  - Fixed parameter order in storage.ts from (organizationId, id) to (id, organizationId)
  - Now matches interface definition and routes.ts usage
- [ ] Add missing error handling
- [ ] Fix type mismatches in JSON fields
- [ ] Fix missing imports

## 📝 Notes
- Original storage.ts backed up as storage_backup.ts
- All database operations now properly generate IDs
- ID format: `{prefix}_{timestamp}_{randomHex}`
