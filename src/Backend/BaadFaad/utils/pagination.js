export function paginationFrom(query = {}) {
  const page = Number.isInteger(query.page) ? query.page : 1;
  const limit = Number.isInteger(query.limit) ? query.limit : 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function paginationMeta({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
