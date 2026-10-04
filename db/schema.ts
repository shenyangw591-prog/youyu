import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const ledgers=sqliteTable('ledgers',{userId:text('user_id').primaryKey(),data:text('data').notNull(),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull()});
