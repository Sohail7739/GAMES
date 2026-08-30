<script setup>
import { computed } from 'vue';

const props = defineProps({
  user: { type: Object, default: null },
  size: { type: String, default: 'md' }, // sm | md | lg
  online: { type: [Boolean, null], default: null },
});

const emo = computed(() => props.user?.id ? ((Number(props.user.id) || 0) % 2 === 0 ? '👨' : '👩') : '👤');
const cls = computed(() => ({ lg: props.size === 'lg', sm: props.size === 'sm' }));
</script>

<template>
  <div class="avatar" :class="cls">
    <span>{{ emo }}</span>
    <span v-if="online !== null" class="online-dot" :class="online ? 'on' : 'off'" />
  </div>
</template>
