import { sqliteTable, text, integer, unique, index } from 'drizzle-orm/sqlite-core';
import { institutions } from './institutions.js';
import { users } from './users.js';

export const hostels = sqliteTable('hostels', {
  id: text('id').primaryKey(),
  institutionId: text('institution_id').notNull().references(() => institutions.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  genderType: text('gender_type').notNull(), // 'boys' | 'girls' | 'coed'
  wardenId: text('warden_id').references(() => users.id),
  totalCapacity: integer('total_capacity').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  codeIdx: index('idx_hostels_code').on(table.code),
  activeIdx: index('idx_hostels_active').on(table.isActive),
}));

export const blocks = sqliteTable('blocks', {
  id: text('id').primaryKey(),
  hostelId: text('hostel_id').notNull().references(() => hostels.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  totalFloors: integer('total_floors').notNull().default(1),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  hostelIdx: index('idx_blocks_hostel').on(table.hostelId),
  uniqueHostelCode: unique('uq_blocks_hostel_code').on(table.hostelId, table.code),
}));

export const floors = sqliteTable('floors', {
  id: text('id').primaryKey(),
  blockId: text('block_id').notNull().references(() => blocks.id, { onDelete: 'restrict' }),
  floorNumber: integer('floor_number').notNull(),
  name: text('name').notNull(),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  blockIdx: index('idx_floors_block').on(table.blockId),
  uniqueBlockFloor: unique('uq_floors_block_floor').on(table.blockId, table.floorNumber),
}));

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  floorId: text('floor_id').notNull().references(() => floors.id, { onDelete: 'restrict' }),
  roomNumber: text('room_number').notNull(),
  capacity: integer('capacity').notNull().default(1),
  roomType: text('room_type').notNull(), // 'single' | 'double' | 'triple' | 'dormitory'
  acType: text('ac_type').notNull().default('non_ac'), // 'ac' | 'non_ac'
  monthlyRent: integer('monthly_rent').notNull().default(0),
  status: text('status').notNull().default('available'), // 'available' | 'full' | 'maintenance' | 'decommissioned'
  isArchived: integer('is_archived').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  floorIdx: index('idx_rooms_floor').on(table.floorId),
  statusIdx: index('idx_rooms_status').on(table.status),
  numberIdx: index('idx_rooms_number').on(table.roomNumber),
  uniqueFloorRoom: unique('uq_rooms_floor_room').on(table.floorId, table.roomNumber),
}));

export const beds = sqliteTable('beds', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'restrict' }),
  bedLabel: text('bed_label').notNull(),
  status: text('status').notNull().default('vacant'), // 'vacant' | 'occupied' | 'maintenance' | 'decommissioned'
  isArchived: integer('is_archived').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  roomIdx: index('idx_beds_room').on(table.roomId),
  statusIdx: index('idx_beds_status').on(table.status),
  uniqueRoomBed: unique('uq_beds_room_bed').on(table.roomId, table.bedLabel),
}));

export const roomAssets = sqliteTable('room_assets', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'restrict' }),
  assetName: text('asset_name').notNull(),
  serialNumber: text('serial_number').unique(),
  condition: text('condition').notNull().default('good'), // 'new' | 'good' | 'damaged' | 'condemned'
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  roomIdx: index('idx_room_assets_room').on(table.roomId),
}));

export type Hostel = typeof hostels.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type Floor = typeof floors.$inferSelect;
export type Room = typeof rooms.$inferSelect;
export type Bed = typeof beds.$inferSelect;
export type RoomAsset = typeof roomAssets.$inferSelect;
