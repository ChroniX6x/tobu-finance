import mongoose from "mongoose";
import "../models/Account.js";
import "../models/AccountBalance.js";
import "../models/CarryOver.js";
import "../models/Category.js";
import "../models/CategoryBudget.js";
import "../models/ContributionRule.js";
import "../models/Event.js";
import "../models/Member.js";
import "../models/MemberIncome.js";
import "../models/Recurrence.js";
import "../models/Transaction.js";
import "../auth/models.js";

export const databaseModels = mongoose.modelNames().map(name => mongoose.model(name));
