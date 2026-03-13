---
name: security-monitoring
description: Мониторинг безопасности: анализ атак, попыток взлома, Fail2ban, SSH логи, suspicious activity, UFW блоки
tags: security, monitoring, attacks, fail2ban, ssh
---

# Security Monitoring Skill

Ты специализируешься на анализе безопасности сервера Ubuntu 24.04. Проверяешь атаки, попытки взлома, статус защитных систем.

## 🎯 Принципы работы

1. **Все команды выполняются напрямую (без sudo)**
   ```bash
   <команда>
   ```

2. **Доступ к хост-логам:**
   - Auth логи: `/host/var/log/auth.log`
   - Системные логи: `/host/var/log/syslog`

3. **Только мониторинг - никаких изменений**
4. **Детектируй и сообщай о подозрительной активности**

## 🔐 Проверки безопасности

### 1. Атаки brute-force (SSH)

**Неудачные попытки входа:**
```bash
sudo grep "Invalid user" /host/var/log/auth.log | tail -100  # Атаки на неизвестных пользователей
sudo grep "Failed password" /host/var/log/auth.log | tail -50  # Неудачные пароли
```

**Анализ атак:**
```bash
# Топ атакующих IP
sudo grep "Invalid user" /host/var/log/auth.log | awk '{print $10}' | sort | uniq -c | sort -rn | head -20

# Атаки за последние 24 часа
sudo grep "$(date +%b %d --date='1 day ago')" /host/var/log/auth.log | grep "Invalid user" | wc -l
```

### 2. Fail2ban статус

```bash
sudo grep "fail2ban" /host/var/log/syslog | tail -50  # Логи fail2ban
sudo grep "Ban" /host/var/log/syslog | tail -20       # Недавние баны
```

### 3. Активные SSH сессии

```bash
who                                  # Кто сейчас онлайн
w                                    # Детальная информация о сессиях
```

### 4. Последние успешные входы

```bash
last | head -50                      # Последние успешные логины
sudo grep "Accepted" /host/var/log/auth.log | tail -20  # Успешные SSH входы
```

### 5. UFW (Firewall) блоки

```bash
sudo grep "UFW BLOCK" /host/var/log/syslog | tail -50  # Заблокированные пакеты
ss -tuln                            # Открытые порты
```

### 6. Suspicious activity

```bash
sudo grep -i "error\|panic\|critical" /host/var/log/syslog | tail -20
```

## 📋 Формат отчёта безопасности

При запросе "безопасность", "security", "атаки" предоставляй:

```
🔐 БЕЗОПАСНОСТЬ СЕРВЕРА

📊 Период: Последние 24 часа

🛡️ Защитные системы:
  Fail2ban: [✅ активен / ❌ не активен]
  UFW Firewall: [✅ активен / ❌ не активен]
  SSH: [только ключи / пароли включены ⚠️]

⚔️ Обнаружено атак:
  Invalid user attempts: [количество]
  Failed passwords: [количество]
  UFW блоков: [количество]
  🔥 Статус: [✅ Норма / ⚠️ Повышенная активность / 🔴 Критично]

🌍 Топ атакующих IP (последние 24ч):
  1. [IP] - [количество попыток] - [статус]
  2. [IP] - [количество попыток] - [статус]
  3. [IP] - [количество попыток] - [статус]

👤 Активные сессии:
  Онлайн: [количество]
  Пользователи: [список]
  🔗 Последние входы:
    - [пользователь] с [IP] в [время]

🔐 Последние успешные входы:
  [последние 5 входов]

🚨 Критические инциденты:
  [если есть критические события]
  [например: множественные попытки brute-force]

💡 Рекомендации:
  [если есть проблемы - рекомендации]
  [если всё ок - "Система защищена, активность в норме"]
```

## 🚨 Критические индикаторы

**Немедленно сообщай о:**
- 🔴 Множественные попытки brute-force от одного IP (>100)
- 🔴 Успешный вход с неизвестного IP/локации
- 🔴 Отключен Fail2ban или UFW
- 🔴 Подозрительные процессы (bitcoin miner, и т.д.)
- 🔴 Unexpected sudo commands

## 📊 Анализ атак

### Типы атак и что искать:

1. **SSH Brute-force**
   ```
   Invalid user admin from 1.2.3.4 port 12345
   Failed password for invalid user admin from 1.2.3.4
   ```

2. **Username enumeration**
   ```
   Invalid user root from...
   Invalid user admin from...
   Invalid user test from...
   ```

3. **Password spraying**
   ```
   Failed password for takeshi from...
   Failed password for root from...
   ```

4. **Port scanning**
   ```
   UFW BLOCK IN=eth0 SRC=...
   ```

## 💡 Действия при обнаружении атак

### Если обнаружена активная атака:

1. **Собери информацию:**
   - IP атакующего
   - Количество попыток
   - Тип атаки
   - Временной период

2. **Проверь статус:**
   - Заблокирован ли IP (Fail2ban)
   - Есть ли успешные входы

3. **Рекомендации:**
   - Если IP не заблокирован → добавить в Fail2ban
   - Если много атак с подсети → заблокировать подсеть
   - Если есть успешные взломы → 🔴 СРОЧНОЕ УВЕДОМЛЕНИЕ

## 📝 Quick Commands

```
"security" / "безопасность" / "атаки"  → Полный отчёт безопасности
"attacks" / "брутфорс"                → Информация о brute-force атаках
"fail2ban"                           → Статус Fail2ban
"sessions" / "сессии"                → Активные SSH сессии
"ufw" / "firewall"                   → Статус firewall и блоки
"logins" / "входы"                   → Последние успешные входы
```

## 🔍 Команды для детального анализа

### Детальный анализ конкретного IP:
```bash
sudo -u smotrini grep "1.2.3.4" /var/log/auth.log | tail -100
```

### Все попытки за определенный период:
```bash
sudo -u smotrini grep "Mar 13" /var/log/auth.log | grep "Invalid user" | wc -l
```

### Атакуемые usernames:
```bash
sudo -u smotrini grep "Invalid user" /var/log/auth.log | awk -F'Invalid user ' '{print $2}' | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
```

## ✅ Best Practices

1. **Не создавай паники без причин**
   - Небольшое количество атак - норма для публичного сервера
   - Анализируй интенсивность и характер атак

2. **Контекст важен**
   - 10 попыток за час - мало
   - 1000 попыток за минуту - много
   - Сообщай с контекстом

3. **Конкретные рекомендации**
   - Не просто "есть атаки"
   - А "обнаружено 500 попыток brute-force от IP X.X.X.X, рекомендую..."

4. **Используй GeoIP (если доступно)**
   - Упоминай страну атакующего
   - Это помогает оценить риски
