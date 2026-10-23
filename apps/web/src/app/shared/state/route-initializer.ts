import { inject } from '@angular/core';
import { Store } from '@ngxs/store';
import { ResolveFn } from '@angular/router';
import { map } from 'rxjs';

export function createStateRouteInitializer(actionFactory: (route: any) => any): ResolveFn<boolean> {
    return (route) => {
        const store = inject(Store);
        const action = actionFactory(route);
        return store.dispatch(action).pipe(
            map(() => {
                return true;
            })
        );
    };
}

