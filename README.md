# Code Answer Evaluation using LLM

## Overview

Code Answer Evaluation using LLM is a web-based application that evaluates source code qualitatively using a Large Language Model (LLM). Instead of relying only on test cases, the system reviews code based on correctness, coding style, and algorithmic efficiency, then returns structured feedback in JSON format.

This project demonstrates the concept of **Prompt Engineering** by automatically constructing a detailed prompt, sending it to an LLM, and displaying the evaluation results in a user-friendly interface.

---

# Objective

Build a prompt pipeline that evaluates submitted code for:

* Correctness
* Coding Style
* Efficiency

The application generates structured qualitative feedback rather than simply indicating whether the code passes or fails.

---

# Features

* Paste code directly into the browser.
* Supports code written in multiple programming languages.
* Automatically builds a prompt for the LLM.
* Evaluates code quality using AI.
* Returns results in JSON format.
* Displays:

  * Correctness
  * Style
  * Efficiency
  * Comments
* Simple and responsive user interface.

---

# Tech Stack

* HTML5
* CSS3
* JavaScript (ES6)
* OpenAI API or Google Gemini API

---

# How It Works

```text
User Pastes Code
        │
        ▼
JavaScript Reads Code
        │
        ▼
Prompt Builder
        │
        ▼
LLM API (GPT/Gemini)
        │
        ▼
JSON Response
        │
        ▼
Display Evaluation
```

---

# Prompt Pipeline

The application follows these steps:

1. User enters source code.
2. JavaScript constructs a structured prompt.
3. The prompt is sent to an LLM.
4. The LLM evaluates:

   * Correctness
   * Style
   * Efficiency
5. The response is parsed.
6. The evaluation is displayed.

---

# Example Prompt

```text
You are an expert software engineer.

Evaluate the following code.

Criteria:
- Correctness
- Style
- Efficiency

Return ONLY JSON.

{
  "correctness":"high|medium|low",
  "style":"high|medium|low",
  "efficiency":"high|medium|low",
  "comments":"..."
}

Code:

<USER_CODE>
```

---

# Sample Input

```python
def add(a,b):
    return a+b
```

---

# Sample Output

```json
{
  "correctness": "high",
  "style": "medium",
  "efficiency": "high",
  "comments": "The code is correct and efficient. Variable names could be more descriptive."
}
```

# Future Improvements

* Support more evaluation metrics (Security, Maintainability, Documentation).
* Automatic programming language detection.
* Download evaluation report as PDF.
* Dark/Light mode toggle.
* Syntax highlighting.
* Line-by-line suggestions.
* Batch evaluation of multiple submissions.

---

# Expected JSON Format

```json
{
  "correctness": "high",
  "style": "medium",
  "efficiency": "low",
  "comments": "The algorithm is logically correct but contains redundant nested loops, resulting in reduced efficiency."
}
```
