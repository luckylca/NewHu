import { CandidateInventoryV3 } from './candidateInventoryV3';
import { prioritizeDeficits, type InterestDeficit } from './candidateDeficit';

export interface AcquisitionV3Decision { action:'NONE'|'ACTIVATE_RESERVE'|'SEARCH_INTEREST'; interestId:string|null; reserveActivated:number; reason:string|null; }
export function resolveReserveBeforeSearchV3(inventory:CandidateInventoryV3,desiredSupply:Record<string,number>,deficits:InterestDeficit[]):AcquisitionV3Decision {
  const ranked=prioritizeDeficits(deficits);
  if(!ranked.length)return{action:'NONE',interestId:null,reserveActivated:0,reason:'NO_DEFICIT'};
  const target=ranked[0]!.deficit;
  if(target.deficit<=0)return{action:'NONE',interestId:null,reserveActivated:0,reason:'NO_DEFICIT'};
  const moved=inventory.activateReserve(target.interestId,desiredSupply[target.interestId]??0);
  if(moved>0)return{action:'ACTIVATE_RESERVE',interestId:target.interestId,reserveActivated:moved,reason:null};
  return{action:'SEARCH_INTEREST',interestId:target.interestId,reserveActivated:0,reason:null};
}
