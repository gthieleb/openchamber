let registry = null;

export function getServerPluginSettingsRegistry() {
  if (!registry) {
    registry = new Map();
  }
  return registry;
}

export function createPluginSettingsAPI(pluginId, source) {
  const reg = getServerPluginSettingsRegistry();

  return {
    schema(config) {
      if (reg.has(pluginId)) {
        throw new Error(`Duplicate settings schema registration for plugin "${pluginId}"`);
      }

      reg.set(pluginId, {
        pluginId,
        source,
        schema: config.schema,
        defaults: config.defaults ?? {},
        version: config.version ?? 1,
        migrate: config.migrate,
      });
    },
  };
}

export function getPluginSettingsSchema(pluginId) {
  const reg = getServerPluginSettingsRegistry();
  return reg.get(pluginId) ?? null;
}

export function getAllPluginSettingsSchemas() {
  const reg = getServerPluginSettingsRegistry();
  return Array.from(reg.values());
}

export function validatePluginSettings(pluginId, values) {
  const entry = getPluginSettingsSchema(pluginId);
  if (!entry) {
    return { valid: false, errors: [`No settings schema registered for plugin "${pluginId}"`] };
  }

  const errors = [];
  const schema = entry.schema;

  if (schema && typeof schema === "object") {
    for (const [key, rule] of Object.entries(schema)) {
      const value = values[key];
      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`Field "${key}" is required`);
      }
      if (value !== undefined && rule.type) {
        const actualType = typeof value;
        if (rule.type === "string" && actualType !== "string") {
          errors.push(`Field "${key}" must be a string`);
        }
        if (rule.type === "number" && actualType !== "number") {
          errors.push(`Field "${key}" must be a number`);
        }
        if (rule.type === "boolean" && actualType !== "boolean") {
          errors.push(`Field "${key}" must be a boolean`);
        }
        if (rule.type === "array" && !Array.isArray(value)) {
          errors.push(`Field "${key}" must be an array`);
        }
      }
      if (value !== undefined && rule.enum && !rule.enum.includes(value)) {
        errors.push(`Field "${key}" must be one of: ${rule.enum.join(", ")}`);
      }
      if (value !== undefined && rule.min !== undefined && typeof value === "number" && value < rule.min) {
        errors.push(`Field "${key}" must be at least ${rule.min}`);
      }
      if (value !== undefined && rule.max !== undefined && typeof value === "number" && value > rule.max) {
        errors.push(`Field "${key}" must be at most ${rule.max}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function migratePluginSettings(pluginId, fromVersion, toVersion, currentValues) {
  const entry = getPluginSettingsSchema(pluginId);
  if (!entry) {
    return { migrated: false, values: currentValues, errors: [`No settings schema for "${pluginId}"`] };
  }

  if (!entry.migrate) {
    if (fromVersion === toVersion) {
      return { migrated: true, values: currentValues, errors: [] };
    }
    return { migrated: false, values: currentValues, errors: [`No migration function for "${pluginId}"`] };
  }

  try {
    const migrated = entry.migrate(currentValues, fromVersion, toVersion);
    return { migrated: true, values: migrated, errors: [] };
  } catch (err) {
    return { migrated: false, values: currentValues, errors: [err.message] };
  }
}

export function unregisterPluginSettings(pluginId) {
  const reg = getServerPluginSettingsRegistry();
  reg.delete(pluginId);
}
