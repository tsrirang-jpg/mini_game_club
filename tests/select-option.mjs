// Exercise the same popover through accessible roles on every game screen.
export async function selectOption(page,label,value) {
  await page.getByRole('combobox',{name:label,exact:true}).click();
  const list=page.getByRole('listbox',{name:label,exact:true});
  if(label==='จำนวนบอท')await list.getByRole('option').nth(Number(value)).click();
  else await list.getByRole('option',{name:value==='normal'?'ปกติ':value==='high'?'ใหญ่ (High)':value,exact:true}).click();
}
export async function countOptions(page,label) {
  await page.getByRole('combobox',{name:label,exact:true}).click();
  const count=await page.getByRole('listbox',{name:label,exact:true}).getByRole('option').count();
  await page.keyboard.press('Escape');return count;
}
