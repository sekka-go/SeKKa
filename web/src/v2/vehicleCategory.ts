/** Public label only. Keep database category codes and capacity rules stable. */
export const displayVehicleCategory=(code:string):string=>code==='SAVER'?'DAILY':code;
