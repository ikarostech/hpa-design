export interface EntityRepository<TEntity, TId> {
  list: () => Promise<readonly TEntity[]>;
  get: (id: TId) => Promise<TEntity | null>;
  save: (entity: TEntity) => Promise<TEntity>;
  remove: (id: TId) => Promise<void>;
}
