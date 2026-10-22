import type { CreateTransactionDto, ValidatedCreateTransaction, PatchTransactionDto, TransactionModel } from '@tobu/contracts/transactions';
const input: CreateTransactionDto = {accountId:'100000000000000000000001',title:'Pending',type:'expense',amountMinor:100,month:'2026-04',isFromSharedAccount:true};
// The client can omit a server-defaulted status. The validated server type cannot.
// @ts-expect-error HTTP input is not the validated output
const output: ValidatedCreateTransaction = input;
// @ts-expect-error money must remain a number
const wrongAmount: CreateTransactionDto = {...input,amountMinor:'100'};
// @ts-expect-error database Date must never leak into JSON response types
const wrongDate: TransactionModel['bookDate'] = new Date();
// @ts-expect-error accountId cannot be patched
const wrongPatch: PatchTransactionDto = {accountId:'100000000000000000000001'};
void [output,wrongAmount,wrongDate,wrongPatch];
