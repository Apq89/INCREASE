-- Apaga os jogos gravados e o ranking de todos os jogadores.
-- As contas (email, palavra-passe e nome de jogador) mantêm-se.
-- Cola no Supabase em SQL Editor → New query → Run.
delete from public.saves;
delete from public.scores;
