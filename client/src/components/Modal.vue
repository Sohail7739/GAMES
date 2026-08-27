<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="modal-panel">
      <div class="row between mb-16">
        <div>
          <div class="modal-title">{{ title }}</div>
          <div v-if="sub" class="modal-sub">{{ sub }}</div>
        </div>
        <button class="icon-btn" @click="emit('close')">✕</button>
      </div>
      <slot />
    </div>
  </div>
</template>
