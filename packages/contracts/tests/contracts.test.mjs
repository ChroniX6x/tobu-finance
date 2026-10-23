import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { CreateTx, PatchTx, QueryTx, TransactionSchema, TransactionsPagedResponseSchema } from '../dist/transactions.js';
import { CreateAccount } from '../dist/accounts.js';
import { CustomSplit } from '../dist/common.js';
import { loginSchema, AuthResponseSchema } from '../dist/auth.js';
import { endpoints, assertResponse } from '../dist/endpoints.js';
import { ApiAccountOverviewSchema } from '../dist/views.js';
const id='100000000000000000000001';
const pending={accountId:id,title:'Pending purchase',type:'expense',amountMinor:1234,month:'2026-04',isFromSharedAccount:true};
const transaction={...pending,_id:id,status:'pending',month:'2026-04-01T00:00:00.000Z',bookDate:null,notes:null,categoryId:null,paidByMemberId:null,parentTransactionId:null,recurrenceId:null};

test('pending without date: valid month and defaults; HTTP input differs from validated output',()=>{
 const parsed=CreateTx.parse(pending);
 assert.equal(parsed.status,'pending'); assert.equal('status' in pending,false);
 assert.equal(CreateTx.safeParse({...pending,month:undefined}).success,false);
 for(const month of ['2026-00','2026-13','04-2026']) assert.equal(CreateTx.safeParse({...pending,month}).success,false);
 assert.equal(CreateAccount.parse({}).currency,'EUR','Existing optional currency default remains unchanged');
});
test('booked, private payments, IDs, money and explicit nulls',()=>{
 assert.equal(CreateTx.safeParse({...pending,status:'booked'}).success,false);
 assert.equal(CreateTx.safeParse({...pending,status:'booked',bookDate:'2026-04-12T00:00:00.000Z'}).success,true);
 assert.equal(CreateTx.safeParse({...pending,isFromSharedAccount:false}).success,false);
 assert.equal(CreateTx.safeParse({...pending,isFromSharedAccount:false,paidByMemberId:id}).success,true);
 for(const amountMinor of [-1,1.5]) assert.equal(CreateTx.safeParse({...pending,amountMinor}).success,false);
 assert.equal(CreateTx.safeParse({...pending,accountId:'bad'}).success,false);
 assert.deepEqual(PatchTx.parse({bookDate:null,notes:null}),{bookDate:null,notes:null});
 assert.deepEqual(PatchTx.parse({}),{});
});
test('query coercion, pagination, sorting and Express array syntax validated before use',()=>{
 const parsed=QueryTx.parse({accountId:id,page:'2','categoryIds[]':[id,'__UNCATEGORIZED__']});
 assert.equal(parsed.page,2);assert.equal(parsed.pageSize,50);assert.equal(parsed.sort,'bookDateDesc');
 assert.deepEqual(parsed.categoryIds,[id,'__UNCATEGORIZED__']);
 assert.equal(QueryTx.safeParse({accountId:id,'categoryIds[]':'invalid'}).success,false);
 for(const patch of [{page:0},{pageSize:201},{sort:'random'},{page:'NaN'}]) assert.equal(QueryTx.safeParse({accountId:id,...patch}).success,false);
});
test('serialized dates, nullable fields, empty and child lists',()=>{
 TransactionSchema.parse(transaction);
 assert.equal(TransactionSchema.safeParse({...transaction,month:new Date()}).success,false);
 TransactionsPagedResponseSchema.parse({items:[],total:0,page:1,pageSize:50});
 TransactionsPagedResponseSchema.parse({items:[{...transaction,children:[transaction]}],total:1,page:1,pageSize:50});
 TransactionsPagedResponseSchema.parse({items:[transaction],total:1,page:1,pageSize:50});
});
test('custom split sums and auth/errors',()=>{
 CustomSplit.parse([{memberId:id,split:100}]); CustomSplit.parse([]);
 assert.equal(CustomSplit.safeParse([{memberId:id,split:99}]).success,false);
 assert.equal(loginSchema.safeParse({email:'bad',password:'short'}).success,false);
 AuthResponseSchema.parse({accessToken:'test',user:{id,email:'demo@example.test',roles:['user']}});
 assertResponse('POST','/api/transactions',400,{error:'VALIDATION_ERROR'});
 assertResponse('GET','/api/accounts',403,{error:'Forbidden'});
 assert.throws(()=>assertResponse('POST','/api/transactions',201,{...transaction,amountMinor:'1234'}));
});
test('breaking contract mutation is detected against a fixed consumer example',()=>{
 const consumer={...pending};
 assert.equal(CreateTx.safeParse(consumer).success,true);
 const incompatible=CreateTx.safeExtend({requiredNewField:z.string()});
 assert.equal(incompatible.safeParse(consumer).success,false);
 const wrongNames={account:{},members:[{monthlyDue:1,paidAmount:1}],charts:{topCategories:[{sum:1}]}};
 assert.equal(ApiAccountOverviewSchema.safeParse(wrongNames).success,false);
});
test('all registered bodies and responses are exportable as OpenAPI 3.1 JSON Schema',()=>{
 for(const endpoint of endpoints) {
  if(endpoint.body) z.toJSONSchema(endpoint.body,{io:'input'});
  if(endpoint.response) z.toJSONSchema(endpoint.response,{io:'output'});
  if(endpoint.query) z.toJSONSchema(endpoint.query,{io:'output'});
 }
});
