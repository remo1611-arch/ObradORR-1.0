export function createTechnicalArchiveDomain({ getRepo } = {}) {
  function counts() {
    const repo = getRepo?.();
    if (!repo) return { ingredients: 0, culinary: 0, bakery: 0 };
    return {
      ingredients: typeof repo.ingredients === 'function' ? (repo.ingredients({ active: 'active' }) || []).length : 0,
      culinary: typeof repo.culinaryRecipes === 'function' ? (repo.culinaryRecipes({ active: 'active' }) || []).length : 0,
      bakery: typeof repo.bakeryRecipes === 'function' ? (repo.bakeryRecipes({ active: 'active' }) || []).length : 0
    };
  }
  return { counts };
}
