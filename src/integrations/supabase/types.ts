export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      answers: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_records: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          id: string
          label: string
          month: string
          note: string
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          currency?: string
          id?: string
          label?: string
          month: string
          note?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          label?: string
          month?: string
          note?: string
          updated_at?: string
        }
        Relationships: []
      }
      dictionary_cache: {
        Row: {
          created_at: string
          result: Json
          word: string
        }
        Insert: {
          created_at?: string
          result: Json
          word: string
        }
        Update: {
          created_at?: string
          result?: Json
          word?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exam_gradings: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          mistakes: Json
          overall_level: string
          part_type: string
          skill: string
          student_text: string | null
          suggestions: Json
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          mistakes?: Json
          overall_level: string
          part_type: string
          skill: string
          student_text?: string | null
          suggestions?: Json
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          mistakes?: Json
          overall_level?: string
          part_type?: string
          skill?: string
          student_text?: string | null
          suggestions?: Json
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exam_question_results: {
        Row: {
          created_at: string
          exam_question_id: string
          id: string
          is_correct: boolean
          skill: string
          test_result_id: string | null
          user_answer: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_question_id: string
          id?: string
          is_correct?: boolean
          skill: string
          test_result_id?: string | null
          user_answer?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          exam_question_id?: string
          id?: string
          is_correct?: boolean
          skill?: string
          test_result_id?: string | null
          user_answer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      exam_questions: {
        Row: {
          audio_url: string | null
          correct_answer: number | null
          created_at: string
          exam_set_id: string
          explanation: string | null
          extra_data: Json | null
          id: string
          image_url: string | null
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          response_time: number | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          correct_answer?: number | null
          created_at?: string
          exam_set_id: string
          explanation?: string | null
          extra_data?: Json | null
          id?: string
          image_url?: string | null
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          response_time?: number | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          correct_answer?: number | null
          created_at?: string
          exam_set_id?: string
          explanation?: string | null
          extra_data?: Json | null
          id?: string
          image_url?: string | null
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          response_time?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_set_id_fkey"
            columns: ["exam_set_id"]
            isOneToOne: false
            referencedRelation: "exam_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sets: {
        Row: {
          created_at: string
          description: string | null
          exam_type: string
          full_test_category: string | null
          full_test_id: string | null
          full_test_title: string | null
          id: string
          is_published: boolean
          part: string
          skill: string
          time_limit: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          exam_type?: string
          full_test_category?: string | null
          full_test_id?: string | null
          full_test_title?: string | null
          id?: string
          is_published?: boolean
          part: string
          skill: string
          time_limit?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          exam_type?: string
          full_test_category?: string | null
          full_test_id?: string | null
          full_test_title?: string | null
          id?: string
          is_published?: boolean
          part?: string
          skill?: string
          time_limit?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      full_test_members: {
        Row: {
          created_at: string
          exam_set_id: string
          full_test_id: string
          id: string
          position: number
        }
        Insert: {
          created_at?: string
          exam_set_id: string
          full_test_id: string
          id?: string
          position?: number
        }
        Update: {
          created_at?: string
          exam_set_id?: string
          full_test_id?: string
          id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "full_test_members_exam_set_id_fkey"
            columns: ["exam_set_id"]
            isOneToOne: false
            referencedRelation: "exam_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "full_test_members_full_test_id_fkey"
            columns: ["full_test_id"]
            isOneToOne: false
            referencedRelation: "full_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      full_tests: {
        Row: {
          category: string
          created_at: string
          id: string
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listening_review_cache: {
        Row: {
          created_at: string
          data: Json
          exam_set_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          exam_set_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          exam_set_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          link_url: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_history: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string | null
          skill: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct: boolean
          question_id?: string | null
          skill: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string | null
          skill?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_config: {
        Row: {
          created_at: string
          description: string
          effective_from: string
          id: string
          is_active: boolean
          model: string | null
          price_per_unit: number
          service: string
          unit_scale: number
          unit_type: string
          updated_at: string
          usd_to_vnd_rate: number
        }
        Insert: {
          created_at?: string
          description?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          model?: string | null
          price_per_unit: number
          service: string
          unit_scale?: number
          unit_type: string
          updated_at?: string
          usd_to_vnd_rate?: number
        }
        Update: {
          created_at?: string
          description?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          model?: string | null
          price_per_unit?: number
          service?: string
          unit_scale?: number
          unit_type?: string
          updated_at?: string
          usd_to_vnd_rate?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          created_at: string
          device_info: string | null
          exam_question_id: string | null
          exam_set_id: string | null
          id: string
          note: string | null
          page_url: string | null
          part_type: string | null
          question_number: number | null
          reason: string
          report_category: string
          skill: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          exam_question_id?: string | null
          exam_set_id?: string | null
          id?: string
          note?: string | null
          page_url?: string | null
          part_type?: string | null
          question_number?: number | null
          reason: string
          report_category?: string
          skill?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_info?: string | null
          exam_question_id?: string | null
          exam_set_id?: string | null
          id?: string
          note?: string | null
          page_url?: string | null
          part_type?: string | null
          question_number?: number | null
          reason?: string
          report_category?: string
          skill?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          audio_url: string | null
          correct_answer: number
          created_at: string
          explanation: string
          id: string
          image_url: string | null
          options: Json
          order_index: number
          question_text: string
          question_type: string
          skill: string
          test_id: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          correct_answer: number
          created_at?: string
          explanation: string
          id?: string
          image_url?: string | null
          options: Json
          order_index?: number
          question_text: string
          question_type?: string
          skill: string
          test_id?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          correct_answer?: number
          created_at?: string
          explanation?: string
          id?: string
          image_url?: string | null
          options?: Json
          order_index?: number
          question_text?: string
          question_type?: string
          skill?: string
          test_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_review_cache: {
        Row: {
          created_at: string
          data: Json
          exam_set_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          exam_set_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          exam_set_id?: string
        }
        Relationships: []
      }
      sentence_translation_cache: {
        Row: {
          created_at: string
          source_text: string
          text_hash: string
          translation_vi: string
        }
        Insert: {
          created_at?: string
          source_text: string
          text_hash: string
          translation_vi: string
        }
        Update: {
          created_at?: string
          source_text?: string
          text_hash?: string
          translation_vi?: string
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          created_at: string
          id: string
          path: string | null
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      speaking_question_gradings: {
        Row: {
          created_at: string
          exam_set_id: string | null
          feedback: string | null
          grammar_errors: Json
          id: string
          improved_version: string | null
          item_index: number
          max_points: number
          part: string
          part_score: number
          pronunciation_errors: Json
          question_text: string | null
          test_result_id: string | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_set_id?: string | null
          feedback?: string | null
          grammar_errors?: Json
          id?: string
          improved_version?: string | null
          item_index: number
          max_points?: number
          part: string
          part_score?: number
          pronunciation_errors?: Json
          question_text?: string | null
          test_result_id?: string | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          exam_set_id?: string | null
          feedback?: string | null
          grammar_errors?: Json
          id?: string
          improved_version?: string | null
          item_index?: number
          max_points?: number
          part?: string
          part_score?: number
          pronunciation_errors?: Json
          question_text?: string | null
          test_result_id?: string | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_question_gradings_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_recordings: {
        Row: {
          audio_url: string
          created_at: string
          duration_seconds: number | null
          exam_set_id: string | null
          id: string
          part: string
          test_result_id: string | null
          user_id: string
        }
        Insert: {
          audio_url: string
          created_at?: string
          duration_seconds?: number | null
          exam_set_id?: string | null
          id?: string
          part: string
          test_result_id?: string | null
          user_id: string
        }
        Update: {
          audio_url?: string
          created_at?: string
          duration_seconds?: number | null
          exam_set_id?: string | null
          id?: string
          part?: string
          test_result_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "speaking_recordings_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_vocab_sets: {
        Row: {
          created_at: string
          description: string | null
          group_name: string
          id: string
          is_published: boolean
          title: string
          updated_at: string
          word_count: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_name?: string
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
          word_count?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          group_name?: string
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
          word_count?: number
        }
        Relationships: []
      }
      system_vocab_words: {
        Row: {
          created_at: string
          example_en: string | null
          example_vi: string | null
          id: string
          meaning: string | null
          order_index: number
          phonetic: string | null
          vocab_set_id: string
          word: string
          word_family: Json | null
          word_type: string
        }
        Insert: {
          created_at?: string
          example_en?: string | null
          example_vi?: string | null
          id?: string
          meaning?: string | null
          order_index?: number
          phonetic?: string | null
          vocab_set_id: string
          word: string
          word_family?: Json | null
          word_type?: string
        }
        Update: {
          created_at?: string
          example_en?: string | null
          example_vi?: string | null
          id?: string
          meaning?: string | null
          order_index?: number
          phonetic?: string | null
          vocab_set_id?: string
          word?: string
          word_family?: Json | null
          word_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_vocab_words_vocab_set_id_fkey"
            columns: ["vocab_set_id"]
            isOneToOne: false
            referencedRelation: "system_vocab_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      test_results: {
        Row: {
          correct_answers: number
          created_at: string
          exam_set_id: string | null
          full_test_id: string | null
          full_test_session_id: string | null
          id: string
          level: string
          review_snapshot: Json | null
          score: number
          skill_scores: Json | null
          test_id: string | null
          time_spent: number | null
          total: number
          user_id: string
        }
        Insert: {
          correct_answers?: number
          created_at?: string
          exam_set_id?: string | null
          full_test_id?: string | null
          full_test_session_id?: string | null
          id?: string
          level: string
          review_snapshot?: Json | null
          score: number
          skill_scores?: Json | null
          test_id?: string | null
          time_spent?: number | null
          total: number
          user_id: string
        }
        Update: {
          correct_answers?: number
          created_at?: string
          exam_set_id?: string | null
          full_test_id?: string | null
          full_test_session_id?: string | null
          id?: string
          level?: string
          review_snapshot?: Json | null
          score?: number
          skill_scores?: Json | null
          test_id?: string | null
          time_spent?: number | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string
          id: string
          part: string
          skill: string
          time_limit: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          part: string
          skill: string
          time_limit?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          part?: string
          skill?: string
          time_limit?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          estimated_cost_vnd: number
          event_type: string
          id: string
          metadata: Json
          model: string | null
          service: string
          source_function: string | null
          unit_type: string
          units: number
        }
        Insert: {
          created_at?: string
          estimated_cost_vnd?: number
          event_type: string
          id?: string
          metadata?: Json
          model?: string | null
          service: string
          source_function?: string | null
          unit_type: string
          units?: number
        }
        Update: {
          created_at?: string
          estimated_cost_vnd?: number
          event_type?: string
          id?: string
          metadata?: Json
          model?: string | null
          service?: string
          source_function?: string | null
          unit_type?: string
          units?: number
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
          selected_answer: string | null
          test_result_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
          selected_answer?: string | null
          test_result_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
          selected_answer?: string | null
          test_result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_answers_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vocab_items: {
        Row: {
          created_at: string
          example_en: string | null
          example_vi: string | null
          id: string
          last_reviewed_at: string | null
          meaning: string | null
          phonetic: string | null
          review_count: number
          sort_order: number
          status: string
          updated_at: string
          user_id: string
          vocab_set_id: string
          word: string
          word_family: Json | null
        }
        Insert: {
          created_at?: string
          example_en?: string | null
          example_vi?: string | null
          id?: string
          last_reviewed_at?: string | null
          meaning?: string | null
          phonetic?: string | null
          review_count?: number
          sort_order?: number
          status?: string
          updated_at?: string
          user_id: string
          vocab_set_id: string
          word: string
          word_family?: Json | null
        }
        Update: {
          created_at?: string
          example_en?: string | null
          example_vi?: string | null
          id?: string
          last_reviewed_at?: string | null
          meaning?: string | null
          phonetic?: string | null
          review_count?: number
          sort_order?: number
          status?: string
          updated_at?: string
          user_id?: string
          vocab_set_id?: string
          word?: string
          word_family?: Json | null
        }
        Relationships: []
      }
      vocab_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      writing_question_gradings: {
        Row: {
          created_at: string
          exam_set_id: string | null
          feedback: string | null
          grammar_errors: Json
          id: string
          item_index: number
          max_points: number
          part: string
          part_score: number
          spelling_errors: Json
          test_result_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_set_id?: string | null
          feedback?: string | null
          grammar_errors?: Json
          id?: string
          item_index?: number
          max_points?: number
          part: string
          part_score?: number
          spelling_errors?: Json
          test_result_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          exam_set_id?: string | null
          feedback?: string | null
          grammar_errors?: Json
          id?: string
          item_index?: number
          max_points?: number
          part?: string
          part_score?: number
          spelling_errors?: Json
          test_result_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "writing_question_gradings_test_result_id_fkey"
            columns: ["test_result_id"]
            isOneToOne: false
            referencedRelation: "test_results"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_db_size_mb: { Args: never; Returns: number }
      get_storage_size_mb: {
        Args: never
        Returns: {
          bucket_id: string
          size_mb: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
