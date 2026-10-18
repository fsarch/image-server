import { Role } from '../constants/role.enum.js';
import { DATABASE_OPTIONS } from '../database/index.js';
import { ImageServerModule } from './image-server.module.js';

export { ImageServerModule };
export const entities = DATABASE_OPTIONS.entities;
export const migrations = DATABASE_OPTIONS.migrations;

/**
 * The frozen equivalent of this service's standalone `main.ts` builder
 * calls (`.enableAuth().enableUac(Object.values(Role)).addSwagger({...})`),
 * as data — see `@fsarch/server`'s `ServiceMountDescriptor`. A mono-service
 * harness spreads this into `.addService({ id, ...descriptor })`; the
 * standalone `main.ts` keeps calling the builder methods directly (no
 * behavior change), just sourcing its values from here instead of
 * duplicating them.
 */
export const descriptor = {
  module: ImageServerModule,
  entities,
  migrations,
  swagger: {
    title: 'Image-Server',
    description: 'The Image-Server API description',
    version: '1.0',
  },
  auth: true,
  uac: { roles: Object.values(Role) },
};
