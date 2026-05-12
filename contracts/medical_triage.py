# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class MedicalTriage(gl.Contract):
    # Flat storage to avoid nested DynArray initialization issues
    all_triages: DynArray[str]
    total_triages: u256

    def __init__(self):
        self.total_triages = u256(0)

    @gl.public.write
    def submit_symptoms(self, symptoms: str, patient_age: int, language: str) -> None:
        prompt = f"""
You are a medical triage assistant. Your ONLY job is to classify urgency — NOT to diagnose.

Patient age: {patient_age}
Symptoms: {symptoms}
Language: {language}

Rules:
- NEVER diagnose a specific disease
- When in doubt, escalate to higher urgency
- Age < 5 or > 70: be more conservative
- Chest pain / difficulty breathing / loss of consciousness = always EMERGENCY

Triage levels:
- EMERGENCY: Life-threatening, go to ER immediately
- URGENT: See doctor within 24-48 hours
- SOON: See doctor this week
- HOME_CARE: Rest at home, monitor symptoms

Respond ONLY as JSON:
{{
    "triage_level": "EMERGENCY|URGENT|SOON|HOME_CARE",
    "key_concern": "main reason in 1 sentence",
    "advice": "what to do next, no diagnosis, 1-2 sentences",
    "red_flags": ["list", "of", "concerning", "symptoms"]
}}
"""

        def leader_fn():
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            valid_levels = ["EMERGENCY", "URGENT", "SOON", "HOME_CARE"]
            if "triage_level" not in result:
                raise gl.vm.UserError("Missing triage_level in response")
            if result["triage_level"] not in valid_levels:
                raise gl.vm.UserError("Invalid triage level returned")
            return result

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            levels = ["HOME_CARE", "SOON", "URGENT", "EMERGENCY"]
            try:
                leader_idx = levels.index(leaders_res.calldata["triage_level"])
                my_idx = levels.index(my_result["triage_level"])
                return abs(leader_idx - my_idx) <= 1
            except (ValueError, KeyError):
                return False

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # Store entry with sender embedded (flat structure avoids DynArray init issues)
        sender_hex = gl.message.sender_address.as_hex
        entry = json.dumps({
            "sender": sender_hex,
            "triage_level": result["triage_level"],
            "key_concern": result["key_concern"],
            "advice": result["advice"],
            "red_flags": result.get("red_flags", []),
            "symptoms_input": symptoms,
            "age": patient_age
        })

        self.all_triages.append(entry)
        self.total_triages = self.total_triages + u256(1)

    @gl.public.view
    def get_my_history(self) -> list:
        sender_hex = gl.message.sender_address.as_hex.lower()
        result = []
        for entry in self.all_triages:
            if sender_hex in entry.lower():
                result.append(entry)
        return result

    @gl.public.view
    def get_all_history(self) -> list:
        return [entry for entry in self.all_triages]

    @gl.public.view
    def get_total_triages(self) -> int:
        return self.total_triages

    @gl.public.view
    def get_disclaimer(self) -> str:
        return (
            "This tool provides triage guidance ONLY. "
            "It does NOT diagnose medical conditions. "
            "Always consult a qualified healthcare professional. "
            "In case of doubt, seek emergency care immediately."
        )
