import { State, Selector, Action, StateContext } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { tap } from 'rxjs/operators';
import { CategoryModel } from '@/shared/models/category.model';
import { CategoriesDataService } from '@/accounts/domain/categories-data.service';

export class LoadCategories {
  static readonly type = '[Categories] Load';
  constructor(public accountId: string) {}
}

@State<CategoryModel[]>({
  name: 'categories',
  defaults: [],
})
@Injectable()
export class CategoriesState {
  constructor(private categoriesService: CategoriesDataService) {}

  @Selector()
  static categories(state: CategoryModel[]) {
    return state;
  }

  @Action(LoadCategories)
  loadCategories(ctx: StateContext<CategoryModel[]>, { accountId }: LoadCategories) {
    return this.categoriesService.getCategoriesForAccountId(accountId).pipe(
      tap((categories) => {
        ctx.setState(categories);
      })
    );
  }
}
