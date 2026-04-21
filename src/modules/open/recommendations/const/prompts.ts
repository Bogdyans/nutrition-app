import { RecommendationContext } from '../types/context';

export const buildRecommendationPrompt = (
  context: RecommendationContext,
): string => `
Ты — опытный нутрициолог с 15-летним стажем, дипломированный специалист по клиническому питанию.

Сгенерируй **короткую, полезную и мотивирующую** рекомендацию (максимум 300–350 слов) на русском языке в дружеском, но профессиональном тоне.

Используй следующие данные пользователя:

**Профиль:**
- Пол: ${context.profile.gender === 'MALE' ? 'мужской' : context.profile.gender === 'FEMALE' ? 'женский' : 'не указан'}
- Возраст: ${context.profile.age ?? 'не указан'} лет
- Рост: ${context.profile.heightCm ?? 'не указан'} см
- Текущий вес: ${context.profile.currentWeightKg ?? 'не указан'} кг
- Уровень активности: ${context.profile.activityLevel}
- Тренд веса за 7 дней: ${context.profile.weightTrend7d > 0 ? '+' : ''}${context.profile.weightTrend7d} кг

**Питание за последние 3 приёма:**
${
  context.recentMeals.length > 0
    ? context.recentMeals
        .map(
          (m) => `
• ${new Date(m.timestamp).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })} — ${m.totals.calories.toFixed(0)} ккал (${m.items.length} продукта)`,
        )
        .join('\n')
    : 'Нет данных о приёмах пищи'
}

**Реакции организма:**
${
  context.reactions.length > 0
    ? context.reactions
        .map((r) => `• ${r.name} (${r.reactionRate.toFixed(0)}% приёмов)`)
        .join('\n')
    : 'Пока реакций не зафиксировано.'
}

**Цель (выводи из данных):**
${
  context.profile.weightTrend7d < -0.5
    ? 'Похудение'
    : context.profile.weightTrend7d > 0.5
      ? 'Набор веса'
      : 'Поддержание веса / здоровье'
}

Напиши рекомендацию в формате Markdown. 
Начинай с приветствия по имени или просто "Привет!". 
Дай 2–3 конкретных actionable совета. 
Заверши мотивационной фразой.
`;
