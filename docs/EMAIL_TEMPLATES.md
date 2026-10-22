# Templates de Email (Supabase)

Para alinhar os emails institucionais ao design escuro do JPL Conecta e resolver o problema de centralização, você deve colar os códigos abaixo na configuração do **Supabase**.

## Como atualizar:
1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Acesse seu projeto e vá em **Authentication** -> **Email Templates**
3. Para cada template (como **Reset Password**, **Confirm Signup**, **Invite User**):
4. No campo "Message body", clique no botão **`< > Source`** (Código-fonte) do editor de texto.
5. Apague o que estiver lá e cole o HTML correspondente abaixo.
6. Clique em **Save**.

---

### Template: Reset Password (Redefinição de Senha)
```html
<div style="background-color: #0d111d; color: #f9fafb; font-family: 'Inter', Helvetica, Arial, sans-serif; padding: 40px 20px; line-height: 1.6; text-align: left;">
  <div style="max-width: 600px; margin: 0; background-color: #111827; padding: 30px; border-radius: 8px; border: 1px solid #1f2937;">
    <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; font-weight: 600;">Redefinição de Senha</h2>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 24px;">
      Olá, recebemos uma solicitação para redefinir a senha da sua conta no <strong>JPL Conecta</strong>.
    </p>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 30px;">
      Clique no botão abaixo para escolher uma nova senha.
    </p>
    <div>
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Redefinir minha senha
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
      Se você não solicitou a redefinição, apenas ignore este email. Nenhuma alteração foi feita na sua conta.<br><br>
      Atenciosamente,<br>Equipe JPL Conecta
    </p>
  </div>
</div>
```

---

### Template: Confirm Signup (Confirmação de Cadastro)
```html
<div style="background-color: #0d111d; color: #f9fafb; font-family: 'Inter', Helvetica, Arial, sans-serif; padding: 40px 20px; line-height: 1.6; text-align: left;">
  <div style="max-width: 600px; margin: 0; background-color: #111827; padding: 30px; border-radius: 8px; border: 1px solid #1f2937;">
    <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; font-weight: 600;">Bem-vindo(a) ao JPL Conecta</h2>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 24px;">
      Falta apenas um passo para você acessar nosso sistema.
    </p>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 30px;">
      Confirme seu endereço de email clicando no botão abaixo:
    </p>
    <div>
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Confirmar meu email
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
      Atenciosamente,<br>Equipe JPL Conecta
    </p>
  </div>
</div>
```

---

### Template: Invite User (Convite para Equipe)
```html
<div style="background-color: #0d111d; color: #f9fafb; font-family: 'Inter', Helvetica, Arial, sans-serif; padding: 40px 20px; line-height: 1.6; text-align: left;">
  <div style="max-width: 600px; margin: 0; background-color: #111827; padding: 30px; border-radius: 8px; border: 1px solid #1f2937;">
    <h2 style="color: #ffffff; margin-top: 0; font-size: 24px; font-weight: 600;">Você foi convidado(a)</h2>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 24px;">
      Você recebeu um convite para acessar o <strong>JPL Conecta</strong>.
    </p>
    <p style="color: #d1d5db; font-size: 16px; margin-bottom: 30px;">
      Clique no botão abaixo para aceitar o convite e configurar sua senha:
    </p>
    <div>
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
        Aceitar Convite
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 14px; margin-top: 30px; border-top: 1px solid #1f2937; padding-top: 20px;">
      Atenciosamente,<br>Equipe JPL Conecta
    </p>
  </div>
</div>
```
