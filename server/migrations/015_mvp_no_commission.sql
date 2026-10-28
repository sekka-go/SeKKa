-- New local ledger writes follow the 0% MVP commission decision.
-- Historical rows remain unchanged and available for audit.
CREATE TRIGGER pool_ledger_mvp_no_commission
BEFORE INSERT ON pool_ledger
FOR EACH ROW
WHEN NEW.company_commission_rate <> 0 OR NEW.company_share_amount <> 0
BEGIN
  SELECT RAISE(ABORT, 'platform commission is disabled in the MVP');
END;
