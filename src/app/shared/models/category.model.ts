export interface CategoryModel {
  _id: string;
  accountId: string;
  name: string;
  customSplit?: { [memberId: string]: number } | { memberId: string, split: number }[];
}
