import { Component, inject, OnInit } from '@angular/core';
import { Store } from '@ngxs/store';

@Component({
  selector: 'app-other-information',
  templateUrl: './other-information.html',
  styleUrls: ['./other-information.scss']
})
export class OtherInformation implements OnInit {

  private store = inject(Store);

  constructor() { }

  ngOnInit() {
  }

}
