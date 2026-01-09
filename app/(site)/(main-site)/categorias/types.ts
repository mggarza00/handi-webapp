export type Subcategory = {
  name: string;
  icon: string | null;
  iconUrl: string | null;
};

export type CategoryCard = {
  name: string;
  color: string | null;
  image: string | null;
  subcategories: Subcategory[];
};
