# Plano: Sistema de PR com Versões Preview

## Índice
1. [Resumo Executivo](#resumo-executivo)
2. [Objetivo](#objetivo)
3. [Fluxo Simplificado](#fluxo-simplificado)
4. [Dependências e Requisitos](#dependências-e-requisitos)
5. [Configurações](#configurações)
6. [Arquitetura da Solução](#arquitetura-da-solução)
   - Workflows do GitHub Actions
   - Scripts de Suporte (Shell)
   - Modificações em Scripts Existentes
   - Status Checks e Branch Protection
7. [Ordem de Implementação](#ordem-de-implementação)
8. [Checklist de Arquivos](#checklist-de-arquivos)
9. [Configurações do GitHub](#configurações-do-github)
10. [Plano de Rollback](#plano-de-rollback)
11. [Por que Shell Script?](#por-que-shell-script-ao-invés-de-nodejs)
12. [Pontos de Atenção](#pontos-de-atenção-para-implementação)

---

## Resumo Executivo

Este plano implementa um sistema automatizado de Pull Requests com validação por versões preview antes da publicação final no NPM.

**Mudanças principais:**
- ✅ Scripts em **Shell** (não Node.js) - mais rápidos e simples
- ✅ **PR criado sempre** que detectar mudanças
- ✅ **Descrição gerada por IA** (Claude) automaticamente
- ✅ **Preview publicada** antes do merge
- ✅ **Merge bloqueado** até preview funcionar
- ✅ **Um único build** - sem re-execuções redundantes

**Ferramentas:** `gh` CLI, `jq`, `curl`, `git`, `npm`

---

## Objetivo
Transformar o workflow atual (publicação direta no NPM) em um sistema baseado em Pull Requests com validação automática:

1. **Detecta mudanças** no WhatsApp Web automaticamente
2. **Gera versão preview** e publica no NPM com tag `preview`
3. **Cria PR automaticamente** com descrição gerada por IA
4. **Bloqueia merge** até que a preview seja publicada com sucesso
5. **Após merge**, publica versão final com tag `latest`

## Fluxo Simplificado

```
Mudanças detectadas
    ↓
Gera pacote preview + publica no NPM
    ↓
Cria/atualiza PR com análise da IA
    ↓
Status check: preview publicada?
    ├─ ✅ Sim → Merge liberado
    └─ ❌ Não → Merge bloqueado
    ↓
Merge aprovado
    ↓
Publica versão final (latest)
```

### Princípios
- **Um único build**: `generate.sh` executa apenas uma vez (no update.yml)
- **PR sempre criado**: Mesmo se publicação preview falhar (para documentar)
- **Validação via preview**: Se preview funciona, versão latest também funcionará
- **IA analisa mudanças**: Claude gera descrição do PR automaticamente

---

## Dependências e Requisitos

### Ambiente GitHub Actions
Todas as ferramentas já estão disponíveis nos runners do GitHub Actions:
- ✅ `gh` CLI - GitHub Command Line Interface
- ✅ `jq` - JSON processor
- ✅ `curl` - HTTP client
- ✅ `git` - Version control
- ✅ `npm` - Node Package Manager

### Secrets do GitHub
- `ANTHROPIC_API_KEY` - Para chamar API do Claude AI
- `NPM_TOKEN` - Para publicar no NPM (já existe)
- `GITHUB_TOKEN` - Automático (não precisa configurar)

---

## Configurações

### Formato de Versões
- **Preview**: `{VERSION}-preview.{BUILD}`
- **Exemplo**: `2.3000.1030404776-preview.1`
- **Build**: Incrementa a cada commit no mesmo PR

### Arquivos Comparados
Tudo em `out/` **EXCETO** `out/dist/`:
- **JSON**: main.json, binary.json, message.json, jid.json, version.json
- **GraphQL**: todos os arquivos em `out/graphql/`
- **Protobuf**: todos os arquivos em `out/protobuf/`

### Comportamento de PRs
- **Branch**: `update/v{VERSION}`
- **Labels**: `whatsapp-update`, `build:{NUMBER}`
- **Criação**: SEMPRE quando detectar mudanças
- **Cleanup**: Fecha PRs antigos automaticamente

### Tags NPM
- **Preview**: `preview` (antes do merge)
- **Final**: `latest` (após merge)
- **Cleanup**: Previews depreciadas após merge

### Validação
- **Status check**: `preview-published`
- **Bloqueio**: Merge só permitido se preview for publicada
- **Segurança**: Se preview funciona → versão latest também funcionará

---

## Arquitetura da Solução

### 1. Workflows do GitHub Actions

#### 1.1 Workflow Principal: `.github/workflows/update.yml`
**Função**: Detecta mudanças, SEMPRE cria PR, publica preview

**Triggers**:
- Schedule: `0 */3 * * *` (a cada 3 horas)
- Manual: `workflow_dispatch`

**Fluxo**:
1. Checkout + Setup Node.js
2. Executar scraper (extrai definições do WhatsApp Web)
3. Comparar checksums (detectar mudanças)
4. **Se houver mudanças**:
   - Fechar PRs antigos: `.github/scripts/close-old-prs.sh`
   - Determinar build: `.github/scripts/get-build-number.sh`
   - Gerar diff: `.github/scripts/generate-diff.sh`
   - Gerar descrição: `.github/scripts/generate-pr-description.sh`
   - Executar `generate.sh` com `PREVIEW_VERSION`
   - Publicar preview: `tools/packager/nodejs/publish-preview.sh`
   - Criar/atualizar PR: `.github/scripts/create-or-update-pr.sh`
   - Reportar status como GitHub check

**Status Check**:
- Nome: `preview-published`
- Success: Preview publicada com sucesso no NPM
- Failure: Erro ao publicar preview (merge bloqueado)

#### 1.2 Workflow de Merge: `.github/workflows/pr-merge.yml`
**Função**: Publicar versão final e cleanup após merge

**Triggers**:
- `pull_request` tipo `closed` com `merged == true`

**Fluxo**:
1. Checkout da branch main (já com merge)
2. Extrair versão do nome da branch
3. **Copiar pacote gerado** de `out/dist/` (já existe no repo)
4. Modificar `package.json` para usar versão final (sem `-preview.{BUILD}`)
5. Publicar no NPM com tag `latest`
6. Deprecar versões preview relacionadas
7. Criar tag git `v{VERSION}`

**Importante**: NÃO executa `generate.sh` novamente

---

### 2. Scripts de Suporte (Shell Script)

> **Por que Shell Script?** Mais simples, sem dependências Node.js, execução mais rápida, uso direto de `gh` CLI e `jq`

#### 2.1 `.github/scripts/generate-diff.sh`
**Função**: Comparar arquivos entre versões e gerar relatório JSON

**Uso**: `./generate-diff.sh <old_version> <new_version>`

**Ferramentas**: `git diff`, `jq`

**Processo**:
1. Buscar commit da versão antiga: `git log --all --grep="v{OLD_VERSION}"`
2. Gerar diff para cada arquivo em `out/` (exceto `dist/`)
3. Contar linhas adicionadas/removidas
4. Validar JSON com `jq`
5. Salvar relatório em `.github/temp/diff-report.json`

**Saída JSON**:
```json
{
  "old_version": "2.3000.x",
  "new_version": "2.3000.y",
  "files": [
    {
      "path": "out/main.json",
      "additions": 15,
      "deletions": 3,
      "valid_json": true
    }
  ]
}
```

#### 2.2 `.github/scripts/generate-pr-description.sh`
**Função**: Gerar descrição do PR usando Claude AI

**Uso**: `./generate-pr-description.sh <old_version> <new_version>`

**Ferramentas**: `curl`, `jq`

**Processo**:
1. Ler `.github/temp/diff-report.json`
2. Construir payload JSON para API do Claude
3. Fazer request: `curl -X POST https://api.anthropic.com/v1/messages`
4. Extrair resposta com `jq` e salvar em `.github/temp/pr-description.md`

**Prompt para Claude**:
```
Analise as mudanças no protocolo WhatsApp Web de {OLD} para {NEW}.

Arquivos alterados: {lista com estatísticas}

Gere descrição do PR (markdown) com:
1. Resumo (3-5 pontos principais)
2. Problemas detectados (se houver)
3. Impacto para desenvolvedores

Seja conciso e objetivo.
```

#### 2.3 `.github/scripts/get-build-number.sh`
**Função**: Determinar próximo número de build

**Uso**: `./get-build-number.sh <version>`

**Ferramentas**: `gh pr list`, `grep`

**Processo**:
```bash
# Buscar PR existente para a versão
PR_NUMBER=$(gh pr list --head "update/v$VERSION" --json number --jq '.[0].number')

if [ -z "$PR_NUMBER" ]; then
  echo "BUILD=1"
  echo "IS_NEW=true"
else
  # Extrair build atual da label
  CURRENT_BUILD=$(gh pr view $PR_NUMBER --json labels --jq '.labels[] | select(.name | startswith("build:")) | .name | split(":")[1]')
  NEW_BUILD=$((CURRENT_BUILD + 1))
  echo "BUILD=$NEW_BUILD"
  echo "IS_NEW=false"
  echo "PR_NUMBER=$PR_NUMBER"
fi
```

**Saída**: Variáveis de ambiente para GitHub Actions

#### 2.4 `.github/scripts/create-or-update-pr.sh`
**Função**: Criar novo PR ou atualizar existente

**Uso**: `./create-or-update-pr.sh <old_version> <new_version> <build> <publish_status>`

**Ferramentas**: `gh pr create`, `gh pr edit`, `git`

**Processo PR Novo**:
```bash
# Criar e fazer push da branch
git checkout -b "update/v$NEW_VERSION"
git add out/
git commit -m "Update WhatsApp Web to v$NEW_VERSION"
git push -u origin "update/v$NEW_VERSION"

# Criar PR com descrição
gh pr create \
  --title "WhatsApp Web v$NEW_VERSION" \
  --body-file .github/temp/pr-description.md \
  --label "whatsapp-update" \
  --label "build:$BUILD"

# Adicionar comentário sobre preview
gh pr comment --body "Preview: \`$NEW_VERSION-preview.$BUILD\` - Status: $PUBLISH_STATUS"
```

**Processo PR Existente**:
```bash
# Atualizar branch
git checkout "update/v$NEW_VERSION"
git pull
git add out/
git commit -m "Update build $BUILD"
git push

# Atualizar PR
gh pr edit $PR_NUMBER --body-file .github/temp/pr-description.md
gh label remove "build:*"  # Remove label antiga
gh label add "build:$BUILD"  # Adiciona nova

# Comentar nova tentativa
gh pr comment $PR_NUMBER --body "New build: \`$NEW_VERSION-preview.$BUILD\` - Status: $PUBLISH_STATUS"
```

#### 2.5 `.github/scripts/close-old-prs.sh`
**Função**: Fechar PRs de versões antigas

**Uso**: `./close-old-prs.sh <current_version>`

**Ferramentas**: `gh pr list`, `gh pr close`

**Processo**:
```bash
# Listar PRs de updates antigos
gh pr list --head "update/v*" --json number,headRefName | jq -r '.[] | select(.headRefName != "update/v'$CURRENT_VERSION'") | .number' | while read PR; do
  # Comentar e fechar
  gh pr comment $PR --body "Fechando: nova versão $CURRENT_VERSION detectada"
  gh pr close $PR --delete-branch

  # Deprecar preview associada (se existir)
  OLD_VERSION=$(gh pr view $PR --json title --jq '.title' | grep -oP 'v\K[0-9.]+')
  ./deprecate-preview.sh $OLD_VERSION
done
```

#### 2.6 `.github/scripts/deprecate-preview.sh`
**Função**: Deprecar versões preview no NPM

**Uso**: `./deprecate-preview.sh <base_version>`

**Ferramentas**: `npm view`, `npm deprecate`

**Processo**:
```bash
# Listar todas as versões preview
npm view wa-kit versions --json | jq -r '.[]' | grep "$BASE_VERSION-preview" | while read VERSION; do
  npm deprecate "wa-kit@$VERSION" "Preview version deprecated after merge to main"
done
```

---

### 3. Modificações em Scripts Existentes

#### 3.1 `tools/packager/nodejs/generate.sh`
**Modificação**: Suportar versão preview

**Mudança na linha 42-44**:
```bash
# ANTES
sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/package.json

# DEPOIS
if [ -n "$PREVIEW_VERSION" ]; then
    echo "Injecting preview version $PREVIEW_VERSION..."
    sed -i 's/{{WA_VERSION}}/'"$PREVIEW_VERSION"'/g' $OUT/package.json
    sed -i 's/{{WA_VERSION}}/'"$PREVIEW_VERSION"'/g' $OUT/readme.md
else
    echo "Injecting version $NEWEST_VERSION..."
    sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/package.json
    sed -i 's/{{WA_VERSION}}/'"$NEWEST_VERSION"'/g' $OUT/readme.md
fi
```

#### 3.2 `tools/packager/nodejs/publish.sh`
**Modificação**: Mudar tag de `beta` para `latest`

```bash
#!/bin/bash

cd $DIST_DIR/nodejs

npm i

# ANTES: --tag beta
# DEPOIS: --tag latest
npm publish --provenance --access public --tag latest
```

#### 3.3 `tools/packager/nodejs/publish-preview.sh` (NOVO)
**Função**: Publicar versão preview

```bash
#!/bin/bash

cd $DIST_DIR/nodejs

npm i

npm publish --provenance --access public --tag preview
```

---

### 4. Estratégia de Armazenamento do Build Number

**Abordagem**: Labels do GitHub PR

**Por quê?**:
- Não requer arquivos extras no repositório
- Atômico (atualiza junto com o PR)
- Fácil de consultar via API do GitHub
- Não polui o histórico git

**Implementação**:
- Label pattern: `build:{NUMBER}`
- Exemplo: `build:1`, `build:2`, `build:3`
- Removida e recriada a cada commit

---

### 5. Status Checks e Branch Protection

#### Status Check: `preview-published`

**Implementação no `update.yml`**:
```yaml
- name: Report preview publish status
  if: always()
  uses: actions/github-script@v7
  with:
    script: |
      const status = '${{ steps.publish_preview.outcome }}';
      const conclusion = status === 'success' ? 'success' : 'failure';

      await github.rest.checks.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        name: 'preview-published',
        head_sha: context.sha,
        status: 'completed',
        conclusion: conclusion,
        output: {
          title: conclusion === 'success'
            ? '✅ Preview version published successfully'
            : '❌ Failed to publish preview version',
          summary: conclusion === 'success'
            ? `Preview version ${process.env.PREVIEW_VERSION} is now available on NPM`
            : 'Preview publication failed. Check logs for details.'
        }
      });
```

#### Branch Protection (main)
**Configuração no GitHub**:
1. Settings → Branches → Branch protection rules
2. Regra para `main`:
   - ✅ Require pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Status checks required: `preview-published`
   - ✅ Require branches to be up to date

---

### 6. Ordem de Implementação

#### Passo 1: Preparar Estrutura
```bash
mkdir -p .github/scripts .github/temp
echo ".github/temp/" >> .gitignore
```

#### Passo 2: Criar Scripts Shell
Implementar nesta ordem (com dependências):
1. `deprecate-preview.sh` (sem dependências)
2. `close-old-prs.sh` (usa deprecate-preview.sh)
3. `generate-diff.sh` (usa git)
4. `generate-pr-description.sh` (usa generate-diff.sh)
5. `get-build-number.sh` (usa gh CLI)
6. `create-or-update-pr.sh` (usa gh CLI)

```bash
chmod +x .github/scripts/*.sh
```

#### Passo 3: Modificar Scripts Existentes
1. `tools/packager/nodejs/generate.sh` - adicionar suporte a `$PREVIEW_VERSION`
2. `tools/packager/nodejs/publish.sh` - mudar tag `beta` → `latest`
3. Criar `tools/packager/nodejs/publish-preview.sh` - tag `preview`

#### Passo 4: Atualizar Workflows
1. Backup: `cp .github/workflows/update.yml .github/workflows/update.yml.backup`
2. Modificar `.github/workflows/update.yml`:
   - Integrar scripts shell
   - Adicionar status check `preview-published`
   - Sempre criar PR
3. Criar `.github/workflows/pr-merge.yml`:
   - Apenas republicar (sem re-build)
   - Deprecar previews

#### Passo 5: Configurar GitHub
1. Adicionar secret `ANTHROPIC_API_KEY`
2. Configurar branch protection em `main`:
   - Require PR
   - Require status check: `preview-published`

#### Passo 6: Testar
```bash
# Trigger manual
gh workflow run update.yml

# Verificar
gh pr list  # PR foi criado?
gh pr checks <PR_NUMBER>  # Status check presente?
```

**Critérios de sucesso:**
- ✅ PR criado mesmo se preview falhar
- ✅ Status check `preview-published` visível
- ✅ Merge bloqueado se preview falhar
- ✅ Merge permitido se preview passar
- ✅ Após merge, versão latest publicada sem re-build

---

### 7. Checklist de Arquivos

#### ✏️ Modificar
- [ ] `.github/workflows/update.yml` - Integrar scripts shell, status check
- [ ] `tools/packager/nodejs/generate.sh` - Suporte a `$PREVIEW_VERSION`
- [ ] `tools/packager/nodejs/publish.sh` - Tag `beta` → `latest`
- [ ] `.gitignore` - Adicionar `.github/temp/`

#### ➕ Criar
**Workflows:**
- [ ] `.github/workflows/pr-merge.yml`

**Scripts Shell:**
- [ ] `.github/scripts/generate-diff.sh`
- [ ] `.github/scripts/generate-pr-description.sh`
- [ ] `.github/scripts/get-build-number.sh`
- [ ] `.github/scripts/create-or-update-pr.sh`
- [ ] `.github/scripts/close-old-prs.sh`
- [ ] `.github/scripts/deprecate-preview.sh`

**Publicação:**
- [ ] `tools/packager/nodejs/publish-preview.sh`

#### ❌ NÃO Criar
- `.github/workflows/pr-validation.yml` - Redundante (validação = publicação preview)

---

### 8. Configurações do GitHub

#### Secrets
- `ANTHROPIC_API_KEY` - API key do Claude AI (obter em console.anthropic.com)
- `NPM_TOKEN` - Já configurado
- `GITHUB_TOKEN` - Automático (GitHub Actions)

#### Branch Protection (main)
- Require pull request before merging: ✅
- Require status checks: ✅
  - `preview-published` (obrigatório)
- Require branches to be up to date: ✅

---

### 9. Plano de Rollback

**Se algo der errado:**
```bash
# 1. Restaurar workflow original
cp .github/workflows/update.yml.backup .github/workflows/update.yml
git add .github/workflows/update.yml
git commit -m "Rollback to original workflow"
git push

# 2. Remover novos workflows
rm .github/workflows/pr-merge.yml

# 3. Remover branch protection (via GitHub UI)
# Settings → Branches → Delete rule for 'main'
```

**Resultado:** Volta ao comportamento antigo (commit direto na main)

**Backup:** Manter por 2 semanas após implementação bem-sucedida

---

### 10. Por que Shell Script ao invés de Node.js?

#### Vantagens
1. **Sem dependências**: Não precisa instalar pacotes npm
2. **Mais rápido**: Execução direta, sem interpretador Node.js
3. **Nativo ao GitHub Actions**: `gh` CLI e `jq` já disponíveis
4. **Mais simples**: Comandos diretos sem camadas de abstração
5. **Menor consumo**: Menos memória e CPU

#### Ferramentas Utilizadas
- `gh` - GitHub CLI (gerenciar PRs, issues, labels)
- `jq` - Processar JSON
- `curl` - Chamadas HTTP (API do Claude)
- `git` - Operações de versionamento
- `npm` - Comandos NPM nativos

#### Exemplo de Simplicidade
**Node.js** (complexo):
```javascript
const { Octokit } = require('@octokit/rest');
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const { data } = await octokit.pulls.list({ owner, repo, head: `update/v${version}` });
```

**Shell** (simples):
```bash
gh pr list --head "update/v$VERSION" --json number --jq '.[0].number'
```

---

## Pontos de Atenção para Implementação

### ⚠️ CRÍTICO
1. **Um único build**: `generate.sh` NUNCA deve ser executado mais de uma vez por versão
2. **PR sempre criado**: Mesmo se publicação preview falhar, o PR deve ser criado
3. **Status check obrigatório**: `preview-published` deve ser reportado em todos os casos

### 🔒 Segurança
1. **API Key**: Nunca expor `ANTHROPIC_API_KEY` em logs ou commits
2. **NPM Token**: Já configurado, não modificar
3. **Permissions**: Scripts shell devem ter permissões de execução

### 🧪 Validação
1. **Testar com preview falhando**: Merge deve ser bloqueado
2. **Testar com preview passando**: Merge deve ser permitido
3. **Testar cleanup**: PRs antigos devem ser fechados automaticamente

### 📝 Convenções
- **Branch**: Sempre `update/v{VERSION}`
- **Labels**: `whatsapp-update` + `build:{NUMBER}`
- **Tag Git**: `v{VERSION}` após merge
- **Tag NPM Preview**: `preview`
- **Tag NPM Final**: `latest`

### 🛠️ Debugging
Se algo falhar, verificar:
```bash
# Ver logs do workflow
gh run list --workflow=update.yml
gh run view <RUN_ID> --log

# Ver PRs abertos
gh pr list --state open

# Ver status checks
gh pr checks <PR_NUMBER>
```

---

## Fim do Plano

**Última atualização:** 2025-11-28
**Versão:** 2.0 (Shell Script)
**Autor:** Plano melhorado com scripts shell ao invés de Node.js