const _prefixes = ["ns_", "user_", "org_", "job_", "doc_"] as const;

export const prefixId = (id: string, prefix: (typeof _prefixes)[number]) => {
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
};

export const normalizeId = (id: string, prefix: (typeof _prefixes)[number]) => {
  return id.startsWith(prefix) ? id.replace(prefix, "") : id;
};
